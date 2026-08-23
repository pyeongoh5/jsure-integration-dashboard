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

  // JST 00:05 = UTC 15:05 (전날)
  cron.schedule('5 15 * * *', () => void materializeTodayPosts().catch(logError('materialize')));
  cron.schedule('* * * * *', () => void publishDuePosts().catch(logError('publish')));
  cron.schedule('*/5 * * * *', () => void retryFailedDms().catch(logError('dm-retry')));
  cron.schedule('*/10 * * * *', () => void cleanupOAuthStates().catch(logError('oauth-cleanup')));

  // 프로세스 기동 시에도 즉시 한 번 (재배포로 크론을 놓친 경우 대비)
  void materializeTodayPosts().catch(logError('materialize'));
}

const logError = (job: string) => (error: unknown) =>
  console.error(`[scheduler:${job}]`, error instanceof Error ? error.message : error);

/** 오늘자(JST) 게시 예정 행 생성. unique(campaignId, dateJst)로 중복 방지. */
export async function materializeTodayPosts(): Promise<void> {
  const prisma = getPrisma();
  const today = dateJst();
  const now = new Date();

  const campaigns = await prisma.brandCampaign.findMany({
    where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gte: now } },
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
    include: { template: true, campaign: { include: { brandAccount: true } } },
    take: 20,
  });

  for (const post of due) {
    const campaign = post.campaign;
    // 캠페인 비활성 또는 기간 밖 → 게시 건너뜀
    if (campaign.status !== 'ACTIVE' || campaign.startsAt > now || campaign.endsAt < now) {
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
      const lpUrl = `${config().WEB_BASE_URL}/c/${campaign.slug}`;
      const text = post.template.bodyText.includes('{{LP_URL}}')
        ? post.template.bodyText.replaceAll('{{LP_URL}}', lpUrl)
        : `${post.template.bodyText}\n${lpUrl}`;

      // F-2.3: 소재에 미디어가 있으면 업로드 후 첨부
      let mediaIds: string[] | undefined;
      if (post.template.mediaUrl) {
        const mediaId = await uploadMediaFromUrl(token, post.template.mediaUrl);
        mediaIds = [mediaId];
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
