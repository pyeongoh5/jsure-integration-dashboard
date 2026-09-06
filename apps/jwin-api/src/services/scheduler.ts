import cron from 'node-cron';
import { getPrisma } from '@jsure/jwin-db';
import { dateJst, jstToUtc } from '@jsure/jwin-shared';
import { config } from '../config';
import { getBrandAccessToken } from '../lib/tokens';
import { createPost, uploadMediaFromUrl } from '../lib/x-api';
import { assignCodeAndSendDm } from './fulfillment';

/**
 * 인프로세스 스케줄러 (Railway 단일 인스턴스 전제 — v1)
 *
 *  1) 00:05 JST: 오늘자 CampaignPost 행 생성 (기간 내 활성 캠페인 × 유효 소재)
 *  2) 매분: 게시 시각이 지난 SCHEDULED 포스트를 실제 게시 (최대 3회 재시도, 미디어 첨부 F-2.3)
 *  3) 5분마다: DM 발송 실패 재시도
 *  4) 10분마다: OAuthState 청소
 *
 * D-2 개정: 검증 홀드/슬롯 회수 없음 — 미검증 당첨은 그대로 미이행 종료.
 *
 * 스케일아웃 시에는 DB 행 잠금(SELECT ... FOR UPDATE SKIP LOCKED) 또는
 * 외부 큐로 교체 필요 — v1 범위 외.
 */

const MAX_POST_ATTEMPTS = 3;

export function startScheduler(): void {
  if (!config().SCHEDULER_ENABLED) return;

  // 프로세스 TZ와 무관하게 JST 00:05에 돌도록 timezone을 명시한다.
  // (UTC 15:05로 표현하면 Railway에 TZ=Asia/Tokyo가 설정되는 순간 15시간 밀린다)
  cron.schedule('5 0 * * *', () => void materializeTodayPosts().catch(logError('materialize')), {
    timezone: 'Asia/Tokyo',
  });
  cron.schedule('* * * * *', () => void publishDuePosts().catch(logError('publish')));
  cron.schedule('*/5 * * * *', () => void retryFailedDms().catch(logError('dm-retry')));
  cron.schedule('*/10 * * * *', () => void cleanupOAuthStates().catch(logError('oauth-cleanup')));

  // 프로세스 기동 시에도 즉시 한 번 (재배포로 크론을 놓친 경우 대비)
  void materializeTodayPosts().catch(logError('materialize'));
}

const logError = (job: string) => (error: unknown) =>
  console.error(`[scheduler:${job}]`, error instanceof Error ? error.message : error);

/**
 * 트윗 본문 조립.
 *
 * 미디어를 첨부하지 않은 트윗은 본문의 URL 로 링크 카드가 만들어지고, 그 카드 이미지를
 * 누르면 링크가 열린다(첨부 이미지는 뷰어만 열린다). 카드가 LP 로 잡히도록 LP URL 을
 * **마지막 줄**에 두고, 이벤트 규칙 링크는 그 앞에 텍스트 링크로 넣는다.
 *
 * 본문이 {{LP_URL}} 로 위치를 직접 지정한 경우엔 그 자리를 존중한다 — 이때는 규칙 링크가
 * 마지막 URL 이 되므로 카드가 규칙 페이지로 잡힐 수 있다(어드민 화면에 안내가 있다).
 */
export function buildPostText(input: {
  bodyText: string;
  lpUrl: string;
  rulesUrl: string | null;
}): string {
  const rulesLine = input.rulesUrl ? `\n${input.rulesUrl}` : '';
  if (input.bodyText.includes('{{LP_URL}}')) {
    return `${input.bodyText.replaceAll('{{LP_URL}}', input.lpUrl)}${rulesLine}`;
  }
  return `${input.bodyText}${rulesLine}\n${input.lpUrl}`;
}

/** 오늘자(JST) 게시 예정 행 생성. unique(campaignId, dateJst)로 중복 방지. */
export async function materializeTodayPosts(): Promise<void> {
  const prisma = getPrisma();
  const today = dateJst();
  const now = new Date();

  // 기간은 시즌이, 진행 상태는 참여가 갖는다.
  const campaigns = await prisma.brandCampaign.findMany({
    where: {
      status: 'ACTIVE',
      campaign: { startsAt: { lte: now }, endsAt: { gte: now } },
    },
    include: { postTemplates: true },
  });

  for (const campaign of campaigns) {
    const template = campaign.postTemplates.find(
      (candidate) => candidate.activeFrom <= now && now <= candidate.activeTo,
    );
    if (!template) continue; // 유효 소재 없음 → 어드민 대시보드에서 경고로 노출
    await prisma.campaignPost
      .create({
        data: {
          campaignId: campaign.id,
          templateId: template.id,
          dateJst: today,
          scheduledAt: jstToUtc(today, campaign.dailyPostTime),
        },
      })
      .catch(() => {}); // P2002(이미 생성) 무시
  }
}

/** 게시 시각이 지난 포스트를 실제로 X에 게시 (템플릿에 mediaUrl 있으면 업로드 후 첨부) */
export async function publishDuePosts(): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const due = await prisma.campaignPost.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    include: {
      template: true,
      campaign: { include: { brandAccount: true, campaign: true } },
    },
    take: 20,
  });

  for (const post of due) {
    const campaign = post.campaign;
    // 참여가 비활성이거나 시즌 기간 밖 → 게시 건너뜀
    const season = campaign.campaign;
    if (campaign.status !== 'ACTIVE' || season.startsAt > now || season.endsAt < now) {
      await prisma.campaignPost.update({ where: { id: post.id }, data: { status: 'SKIPPED' } });
      continue;
    }
    const brandAccount = campaign.brandAccount;
    if (!brandAccount || !brandAccount.encryptedAccessToken || !post.template) {
      await prisma.campaignPost.update({
        where: { id: post.id },
        data: {
          status: 'FAILED',
          lastError:
            brandAccount && brandAccount.encryptedAccessToken ? 'no template' : 'brand not connected',
        },
      });
      continue;
    }
    try {
      const token = await getBrandAccessToken(brandAccount);
      // 참여 LP: /c/{시즌 slug}/{브랜드 slug}
      const lpUrl = `${config().WEB_BASE_URL}/c/${season.slug}/${brandAccount.slug}`;
      const text = buildPostText({
        bodyText: post.template.bodyText,
        lpUrl,
        rulesUrl: campaign.rulesUrl,
      });

      // F-2.3: 첨부 미디어를 순서대로 업로드해 붙인다. mediaUrls 도입 전 행은 단일 mediaUrl 사용.
      const mediaUrls =
        post.template.mediaUrls.length > 0
          ? post.template.mediaUrls
          : post.template.mediaUrl
            ? [post.template.mediaUrl]
            : [];
      const mediaIds: string[] = [];
      for (const mediaUrl of mediaUrls) {
        mediaIds.push(await uploadMediaFromUrl(token, mediaUrl));
      }

      const created = await createPost(token, text, mediaIds);
      await prisma.campaignPost.update({
        where: { id: post.id },
        data: {
          status: 'POSTED',
          xPostId: created.data.id,
          postedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    } catch (error) {
      const attempts = post.attempts + 1;
      await prisma.campaignPost.update({
        where: { id: post.id },
        data: {
          attempts,
          lastError: error instanceof Error ? error.message : 'post failed',
          status: attempts >= MAX_POST_ATTEMPTS ? 'FAILED' : 'SCHEDULED',
        },
      });
    }
  }
}

/** DM 발송 실패 재시도 */
export async function retryFailedDms(): Promise<void> {
  const prisma = getPrisma();
  const failed = await prisma.winner.findMany({
    where: { verification: 'PASSED', fulfillment: 'FAILED', prize: { type: 'CODE' } },
    take: 20,
  });
  for (const winner of failed) {
    await assignCodeAndSendDm(winner.id);
  }
}

export async function cleanupOAuthStates(): Promise<void> {
  await getPrisma().oAuthState.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } },
  });
}
