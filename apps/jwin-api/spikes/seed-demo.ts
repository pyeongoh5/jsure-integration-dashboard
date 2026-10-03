// 데모 시드: X 연동 없이 전 화면 베리에이션을 로컬에서 확인하기 위한 목업 데이터.
//
// 사용법:
//   cd apps/jwin-api && npx tsx spikes/seed-demo.ts
//   pnpm dev:all 기동 후 http://localhost:8080/dev/login 접속(데모 유저 로그인)
//   → http://localhost:3100/c/demo 부터 둘러본다.
//
// 만들어지는 베리에이션 (시즌 demo, 브랜드 응모 페이지 /c/demo/{slug}):
//   demo-pending   오늘 당첨 후보 — 검증 대기 (재검증 버튼)
//   demo-repost    오늘 당첨 후보 — 리포스트 미확인 사유 표시
//   demo-lose      오늘 낙첨 화면
//   demo-physical  오늘 당첨 확정(현물) — 배송지 입력 / 어제 당첨은 입력 완료(수정 가능)
//   demo-code      오늘 당첨 확정(코드) — DM 발송 완료 안내
//   demo-prepost   오늘 게시 없음 — "HH:mm 頃投稿予定" 안내
//   시즌 demo-ended 의 demo-closed — 종료 화면 + 배송지 마감
//
// 몇 번을 다시 돌려도 안전하다 — demo 시즌·브랜드를 지우고 다시 만든다.
import '../spikes/env';
import { getPrisma } from '@jsure/jwin-db';
import { dateJst, jstToUtc } from '@jsure/jwin-shared';
import { encrypt } from '../src/lib/crypto';

const prisma = getPrisma();

const DAY_MS = 24 * 60 * 60 * 1000;
const image = (seed: string, size = 800) => `https://picsum.photos/seed/${seed}/${size}/${size}`;

function jstDate(offsetDays: number): string {
  return dateJst(new Date(Date.now() + offsetDays * DAY_MS));
}

async function wipeDemo() {
  const demoCampaigns = await prisma.campaign.findMany({
    where: { slug: { in: ['demo', 'demo-ended'] } },
    select: { id: true },
  });
  const campaignIds = demoCampaigns.map((campaign) => campaign.id);
  const participations = await prisma.brandCampaign.findMany({
    where: { campaignId: { in: campaignIds } },
    select: { id: true },
  });
  const participationIds = participations.map((participation) => participation.id);

  await prisma.prizeCode.deleteMany({ where: { prize: { campaignId: { in: participationIds } } } });
  await prisma.winner.deleteMany({ where: { entry: { campaignId: { in: participationIds } } } });
  await prisma.entry.deleteMany({ where: { campaignId: { in: participationIds } } });
  await prisma.campaignPost.deleteMany({ where: { campaignId: { in: participationIds } } });
  await prisma.postTemplate.deleteMany({ where: { campaignId: { in: participationIds } } });
  await prisma.prize.deleteMany({ where: { campaignId: { in: participationIds } } });
  await prisma.brandCampaign.deleteMany({ where: { id: { in: participationIds } } });
  await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
  await prisma.brandXAccount.deleteMany({ where: { slug: { startsWith: 'demo-' } } });
}

type BrandSpec = {
  slug: string;
  label: string;
  /** 오늘 게시물 생성 여부 (false = 게시 전 안내 화면) */
  postToday: boolean;
  prizeType: 'PHYSICAL' | 'CODE';
};

async function main() {
  await wipeDemo();

  const user = await prisma.user.upsert({
    where: { xUserId: 'demo-user' },
    update: {},
    create: { xUserId: 'demo-user', xUsername: 'demo_user', displayName: '데모 유저' },
  });

  // ── 진행 중 시즌 demo ──
  const season = await prisma.campaign.create({
    data: {
      name: '데모 시즌 캠페인',
      slug: 'demo',
      startsAt: new Date(Date.now() - 3 * DAY_MS),
      endsAt: new Date(Date.now() + 7 * DAY_MS),
      dailyPostTime: '12:00',
      keyVisualUrl: `https://picsum.photos/seed/keyvisual/1200/500`,
      listBackgroundUrl: `https://picsum.photos/seed/background/1200/1600`,
      thumbnailUrl: `https://picsum.photos/seed/thumb/900/300`,
    },
  });

  const brands: BrandSpec[] = [
    { slug: 'demo-pending', label: '검증 대기 브랜드', postToday: true, prizeType: 'PHYSICAL' },
    { slug: 'demo-repost', label: '리포스트 미확인 브랜드', postToday: true, prizeType: 'CODE' },
    { slug: 'demo-lose', label: '낙첨 브랜드', postToday: true, prizeType: 'CODE' },
    { slug: 'demo-physical', label: '현물 당첨 브랜드', postToday: true, prizeType: 'PHYSICAL' },
    { slug: 'demo-code', label: '코드 당첨 브랜드', postToday: true, prizeType: 'CODE' },
    { slug: 'demo-prepost', label: '게시 전 브랜드', postToday: false, prizeType: 'CODE' },
  ];

  for (const spec of brands) {
    const account = await prisma.brandXAccount.create({
      data: {
        slug: spec.slug,
        label: spec.label,
        logoUrl: image(`${spec.slug}-logo`, 100),
        xUserId: `demo-x-${spec.slug}`,
        xUsername: spec.slug.replace(/-/g, '_'),
      },
    });
    const participation = await prisma.brandCampaign.create({
      data: {
        campaignId: season.id,
        brandAccountId: account.id,
        status: 'ACTIVE',
        dmTemplate: '当選おめでとうございます！コード: {{CODE}}',
        prUrl: 'https://example.com',
      },
    });
    const template = await prisma.postTemplate.create({
      data: {
        campaignId: participation.id,
        label: '데모 소재',
        bodyText: '毎日応募OK！フォロー&リポストでその場で当たる！ {{LP_URL}}',
        mediaUrls: [image(spec.slug)],
        cardTitle: '☝️抽選はこちらをタップ',
        activeFrom: season.startsAt,
        activeTo: season.endsAt,
      },
    });
    const prize = await prisma.prize.create({
      data: {
        campaignId: participation.id,
        type: spec.prizeType,
        name: spec.prizeType === 'PHYSICAL' ? '데모 현물 경품' : '데모 기프트코드 1000円',
        tier: 1,
        totalQty: 10,
        remainingQty: 8,
        winProbability: 0.5,
      },
    });

    const posts: Record<string, string> = {};
    for (const offset of spec.postToday ? [-1, 0] : [-1]) {
      const date = jstDate(offset);
      const post = await prisma.campaignPost.create({
        data: {
          campaignId: participation.id,
          templateId: template.id,
          dateJst: date,
          scheduledAt: jstToUtc(date, '12:00'),
          status: 'POSTED',
          xPostId: `200000000000000${Math.abs(offset)}`,
          postedAt: jstToUtc(date, '12:00'),
        },
      });
      posts[date] = post.id;
    }

    const today = jstDate(0);
    const yesterday = jstDate(-1);

    const makeEntry = (date: string, result: 'LOSE' | 'WIN_PENDING' | 'WIN_CONFIRMED') =>
      prisma.entry.create({
        data: {
          campaignId: participation.id,
          userId: user.id,
          postId: posts[date] as string,
          dateJst: date,
          result,
        },
      });

    if (spec.slug === 'demo-pending') {
      const entry = await makeEntry(today, 'WIN_PENDING');
      await prisma.winner.create({
        data: { entryId: entry.id, prizeId: prize.id, verification: 'PENDING' },
      });
    }
    if (spec.slug === 'demo-repost') {
      const entry = await makeEntry(today, 'WIN_PENDING');
      await prisma.winner.create({
        data: { entryId: entry.id, prizeId: prize.id, verification: 'REPOST_FAILED' },
      });
    }
    if (spec.slug === 'demo-lose') {
      await makeEntry(today, 'LOSE');
    }
    if (spec.slug === 'demo-physical') {
      // 오늘: 확정 + 배송지 미입력 / 어제: 확정 + 배송지 입력 완료 (수정 가능 화면)
      const todayEntry = await makeEntry(today, 'WIN_CONFIRMED');
      await prisma.winner.create({
        data: {
          entryId: todayEntry.id,
          prizeId: prize.id,
          verification: 'PASSED',
          verifiedAt: new Date(),
          fulfillment: 'AWAITING_INFO',
        },
      });
      const yesterdayEntry = await makeEntry(yesterday, 'WIN_CONFIRMED');
      await prisma.winner.create({
        data: {
          entryId: yesterdayEntry.id,
          prizeId: prize.id,
          verification: 'PASSED',
          verifiedAt: new Date(Date.now() - DAY_MS),
          fulfillment: 'READY',
          encryptedShipping: encrypt(
            JSON.stringify({
              fullName: '山田 太郎',
              nameKana: 'ヤマダ タロウ',
              phone: '09012345678',
              postalCode: '123-4567',
              prefecture: '東京都',
              address1: '渋谷区1-2-3',
              address2: 'デモビル101',
            }),
          ),
          shippingEnteredAt: new Date(Date.now() - DAY_MS),
        },
      });
    }
    if (spec.slug === 'demo-code') {
      const entry = await makeEntry(today, 'WIN_CONFIRMED');
      await prisma.winner.create({
        data: {
          entryId: entry.id,
          prizeId: prize.id,
          verification: 'PASSED',
          verifiedAt: new Date(),
          fulfillment: 'DM_SENT',
          dmSentAt: new Date(),
        },
      });
    }
  }

  // ── 종료 시즌 demo-ended: 종료 화면 + 배송지 입력 마감 ──
  const endedSeason = await prisma.campaign.create({
    data: {
      name: '종료된 데모 시즌',
      slug: 'demo-ended',
      startsAt: new Date(Date.now() - 10 * DAY_MS),
      endsAt: new Date(Date.now() - 2 * DAY_MS),
      dailyPostTime: '12:00',
    },
  });
  const endedAccount = await prisma.brandXAccount.create({
    data: {
      slug: 'demo-closed',
      label: '종료 브랜드',
      logoUrl: image('demo-closed-logo', 100),
      xUserId: 'demo-x-closed',
      xUsername: 'demo_closed',
    },
  });
  const endedParticipation = await prisma.brandCampaign.create({
    data: { campaignId: endedSeason.id, brandAccountId: endedAccount.id, status: 'ENDED' },
  });
  const endedTemplate = await prisma.postTemplate.create({
    data: {
      campaignId: endedParticipation.id,
      label: '데모 소재',
      bodyText: '終了したキャンペーンです {{LP_URL}}',
      mediaUrls: [image('demo-closed')],
      activeFrom: endedSeason.startsAt,
      activeTo: endedSeason.endsAt,
    },
  });
  const endedPrize = await prisma.prize.create({
    data: {
      campaignId: endedParticipation.id,
      type: 'PHYSICAL',
      name: '마감 확인용 현물 경품',
      tier: 1,
      totalQty: 5,
      remainingQty: 4,
      winProbability: 0.5,
    },
  });
  const endedDate = jstDate(-3);
  const endedPost = await prisma.campaignPost.create({
    data: {
      campaignId: endedParticipation.id,
      templateId: endedTemplate.id,
      dateJst: endedDate,
      scheduledAt: jstToUtc(endedDate, '12:00'),
      status: 'POSTED',
      xPostId: '2000000000000009',
      postedAt: jstToUtc(endedDate, '12:00'),
    },
  });
  const endedEntry = await prisma.entry.create({
    data: {
      campaignId: endedParticipation.id,
      userId: user.id,
      postId: endedPost.id,
      dateJst: endedDate,
      result: 'WIN_CONFIRMED',
    },
  });
  await prisma.winner.create({
    data: {
      entryId: endedEntry.id,
      prizeId: endedPrize.id,
      verification: 'PASSED',
      verifiedAt: new Date(Date.now() - 3 * DAY_MS),
      fulfillment: 'AWAITING_INFO', // 미입력인 채 시즌 종료 → 마감 화면
    },
  });

  console.log('데모 시드 완료. 둘러보기:');
  console.log('  1) http://localhost:8080/dev/login  (데모 유저 로그인 → /c/demo 로 이동)');
  console.log('  2) 시즌 LP:        http://localhost:3100/c/demo');
  console.log('  3) 응모 베리에이션: /c/demo/demo-pending · demo-repost · demo-lose · demo-physical · demo-code · demo-prepost');
  console.log('  4) 종료·마감:      http://localhost:3100/c/demo-ended/demo-closed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
