import type { PrismaService } from "../prisma/prisma.service";

type RewardRecruit = {
  subType: string;
  rewardJpy: number | null;
  options?: { option: string; rewardJpy: number | null }[];
};

type SelectedOption = { subType: string; option: string };

/**
 * 서브타입 1개의 보수 기여.
 * 옵션별 보수 분리 recruit(모든 옵션 행에 rewardJpy 존재)이면 응모가 선택한
 * 옵션의 보수, 아니면 recruit.rewardJpy. 보수 분리 활성화 시 기존 응모 전체에
 * 옵션 선택이 있음을 캠페인 저장 검증이 보장하므로 별도 fallback 은 두지 않는다.
 */
function recruitRewardContribution(
  recruit: RewardRecruit,
  selectedOption: string | null,
): number {
  const options = recruit.options ?? [];
  const rewardSplit =
    options.length > 0 && options.every((option) => option.rewardJpy !== null);
  if (!rewardSplit) return recruit.rewardJpy ?? 0;
  const matched = selectedOption
    ? options.find((option) => option.option === selectedOption)
    : undefined;
  return matched?.rewardJpy ?? 0;
}

/**
 * 응모 기준 보수 금액: UNIFIED 는 고정, PER_SUBTYPE 은 참여 서브타입 기여 합산
 * (옵션별 보수 분리 recruit 은 선택 옵션의 보수).
 */
export function applicationRewardJpy(
  campaign: {
    rewardType: "UNIFIED" | "PER_SUBTYPE";
    rewardJpy: number;
    recruits: RewardRecruit[];
  },
  subTypes: string[],
  selectedOptions: SelectedOption[],
): number {
  if (campaign.rewardType !== "PER_SUBTYPE") return campaign.rewardJpy;
  return campaign.recruits
    .filter((recruit) => subTypes.includes(recruit.subType))
    .reduce((sum, recruit) => {
      const selected =
        selectedOptions.find((entry) => entry.subType === recruit.subType)
          ?.option ?? null;
      return sum + recruitRewardContribution(recruit, selected);
    }, 0);
}

/** 응모 기준 정산 금액(보수 + 가구매 상품 환급). */
export function settlementAmounts(
  campaign: {
    category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW";
    rewardType: "UNIFIED" | "PER_SUBTYPE";
    rewardJpy: number;
    recruits: (RewardRecruit & { productPriceJpy: number | null })[];
  },
  subTypes: string[],
  selectedOptions: SelectedOption[],
): { rewardAmountJpy: number; productRefundJpy: number } {
  const rewardAmountJpy = applicationRewardJpy(
    campaign,
    subTypes,
    selectedOptions,
  );
  const productRefundJpy =
    campaign.category === "FAKE_PURCHASE"
      ? campaign.recruits
          .filter((recruit) => subTypes.includes(recruit.subType))
          .reduce((sum, recruit) => sum + (recruit.productPriceJpy ?? 0), 0)
      : 0;
  return { rewardAmountJpy, productRefundJpy };
}

/**
 * 응모(Application)의 제출물이 승인(APPROVED)되고 정산 가능 상태가 되면
 * Settlement(PENDING) 를 멱등하게 생성한다. 정산은 응모 단위 1건이다.
 *
 * 카테고리별 조건:
 * - SNS: insightRequired=true 인 참여 서브타입의 인사이트가 모두 제출돼야 한다.
 * - FAKE_PURCHASE / SIMPLE_REVIEW: 제출물 승인만 되면 즉시 생성.
 *
 * 정산액:
 * - rewardAmountJpy = UNIFIED 면 campaign.rewardJpy, PER_SUBTYPE 면 참여
 *   서브타입 기여 합산(옵션별 보수 분리 recruit 은 선택 옵션의 보수)
 * - productRefundJpy = 가구매(FAKE_PURCHASE)만 recruit.productPriceJpy 합산
 *
 * 총액 0원이면 정산 대기 없이 COMPLETED 로 자동 완료 생성한다. 이번 호출에서
 * 자동 완료가 일어났을 때만 autoCompleted=true — 호출자가 캠페인 종료 메시지를
 * 발송할지 판단하는 데 쓴다.
 */
export async function ensureSettlementForApplication(
  prisma: PrismaService,
  applicationId: string,
): Promise<{ autoCompleted: boolean }> {
  const application = await prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    select: {
      submissionReviewStatus: true,
      subTypes: true,
      options: { select: { subType: true, option: true } },
      posts: { select: { subType: true, insightSubmittedAt: true } },
      settlement: { select: { id: true } },
      influencer: {
        select: {
          bankAccount: {
            select: {
              bankCode: true,
              bankName: true,
              branchName: true,
              branchCode: true,
              accountNumber: true,
              accountHolderKana: true,
            },
          },
        },
      },
      campaign: {
        select: {
          category: true,
          rewardType: true,
          rewardJpy: true,
          recruits: {
            select: {
              subType: true,
              insightRequired: true,
              productPriceJpy: true,
              rewardJpy: true,
              options: { select: { option: true, rewardJpy: true } },
            },
          },
        },
      },
    },
  });
  if (!application) return { autoCompleted: false };
  if (application.submissionReviewStatus !== "APPROVED") {
    return { autoCompleted: false };
  }
  // 이미 정산이 생성돼 있으면 그대로 둔다 (멱등).
  if (application.settlement) return { autoCompleted: false };

  const { campaign } = application;
  const participatingRecruits = campaign.recruits.filter((recruit) =>
    application.subTypes.includes(recruit.subType),
  );

  if (campaign.category === "SNS") {
    const insightMissing = participatingRecruits.some((recruit) => {
      if (!recruit.insightRequired) return false;
      const post = application.posts.find(
        (candidate) => candidate.subType === recruit.subType,
      );
      return !post || post.insightSubmittedAt === null;
    });
    if (insightMissing) return { autoCompleted: false };
  }

  const { rewardAmountJpy, productRefundJpy } = settlementAmounts(
    campaign,
    application.subTypes,
    application.options,
  );
  const amountJpy = rewardAmountJpy + productRefundJpy;
  // 총액 0원이면 정산 대기를 거치지 않고 즉시 완료 (캠페인 종료).
  const autoCompleted = amountJpy === 0;

  // 정산 대기풀 진입 시점의 계좌를 스냅샷 — 이후 마이페이지에서 계좌를 바꿔도
  // 이 정산 건의 입금 계좌 기록은 보존된다.
  const bankSnapshot = application.influencer.bankAccount ?? {
    bankCode: null,
    bankName: null,
    branchName: null,
    branchCode: null,
    accountNumber: null,
    accountHolderKana: null,
  };

  await prisma.settlement.upsert({
    where: { applicationId },
    create: {
      applicationId,
      amountJpy,
      rewardAmountJpy,
      productRefundJpy,
      status: autoCompleted ? "COMPLETED" : "PENDING",
      completedAt: autoCompleted ? new Date() : null,
      ...bankSnapshot,
    },
    update: {},
  });
  return { autoCompleted };
}
