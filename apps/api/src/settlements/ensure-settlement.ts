import { IN_PROGRESS_STATUSES } from "@jsure/shared";
import type { PrismaService } from "../prisma/prisma.service";

/** campaignApplication.updateMany 만 필요한 최소 인터페이스 — 트랜잭션 클라이언트도 받는다. */
type ApplicationUpdater = {
  campaignApplication: {
    updateMany: (args: {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    }) => Promise<{ count: number }>;
  };
};

/**
 * 정산이 완료된 응모를 COMPLETED 로 넘긴다.
 *
 * 정산 완료가 곧 캠페인 종료다. 이걸 하지 않으면 응모는 영원히 REVIEW_SUBMITTED 에
 * 머물러, 탈퇴 차단처럼 "진행 중"을 묻는 모든 판정이 끝난 건을 진행 중으로 본다.
 * 진행 구간(IN_PROGRESS_STATUSES)에 있는 건만 건드린다 — 반려·취소 건은 그대로 둔다.
 */
export async function markApplicationsCompleted(
  prisma: ApplicationUpdater,
  applicationIds: string[],
  completedAt: Date,
): Promise<number> {
  if (applicationIds.length === 0) return 0;
  const { count } = await prisma.campaignApplication.updateMany({
    where: {
      id: { in: applicationIds },
      status: { in: IN_PROGRESS_STATUSES },
    },
    data: { status: "COMPLETED", completedAt },
  });
  return count;
}

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

type RefundBasis = {
  /** 인플루언서가 주문 제출 시 입력한 실결제 금액. 도입 전 응모는 null. */
  actualPaymentJpy: number | null;
  /** 운영자가 승인하며 영수증과 대조해 조정한 확정액. 조정하지 않았으면 null. */
  override?: number | null;
};

/**
 * 가구매 상품 환급액 — 우선순위 3단.
 * 1) 운영자 조정액 2) 인플루언서가 제출한 실결제 금액
 * 3) 둘 다 없으면(필드 도입 전 응모) 캠페인 모집 설정의 상품가 합산
 *
 * 가구매가 아니면 환급은 없다.
 */
function productRefundFor(
  campaign: {
    category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW";
    recruits: { subType: string; productPriceJpy: number | null }[];
  },
  subTypes: string[],
  refund: RefundBasis,
): number {
  if (campaign.category !== "FAKE_PURCHASE") return 0;
  if (refund.override != null) return refund.override;
  if (refund.actualPaymentJpy != null) return refund.actualPaymentJpy;
  return campaign.recruits
    .filter((recruit) => subTypes.includes(recruit.subType))
    .reduce((sum, recruit) => sum + (recruit.productPriceJpy ?? 0), 0);
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
  refund: RefundBasis,
): { rewardAmountJpy: number; productRefundJpy: number } {
  const rewardAmountJpy = applicationRewardJpy(
    campaign,
    subTypes,
    selectedOptions,
  );
  return {
    rewardAmountJpy,
    productRefundJpy: productRefundFor(campaign, subTypes, refund),
  };
}

/**
 * SNS 응모의 정산이 인사이트 미제출로 막혀 있는지. 참여 서브타입 중
 * insightRequired 인 것의 인사이트가 하나라도 없으면 true.
 *
 * 정산 생성 조건과 인사이트 독촉 대상이 항상 같은 기준을 쓰도록 여기서 한 번만
 * 정의한다. 모집 후 insightRequired 를 해제하면 정산은 바로 생성되는데 독촉만
 * 계속 나가던 문제가 두 조건이 갈라져 있었기 때문이다.
 */
export function insightMissingForSettlement(application: {
  subTypes: string[];
  posts: { subType: string; insightSubmittedAt: Date | null }[];
  campaign: { recruits: { subType: string; insightRequired: boolean }[] };
}): boolean {
  return application.campaign.recruits.some((recruit) => {
    if (!recruit.insightRequired) return false;
    if (!application.subTypes.includes(recruit.subType)) return false;
    const post = application.posts.find(
      (candidate) => candidate.subType === recruit.subType,
    );
    return !post || post.insightSubmittedAt === null;
  });
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
 * - productRefundJpy = 가구매(FAKE_PURCHASE)만. productRefundOverride(운영자 조정액)
 *   → application.actualPaymentJpy(실결제 금액) → recruit.productPriceJpy 순 폴백.
 *
 * 총액 0원이면 정산 대기 없이 COMPLETED 로 자동 완료 생성한다. 이번 호출에서
 * 자동 완료가 일어났을 때만 autoCompleted=true — 호출자가 캠페인 종료 메시지를
 * 발송할지 판단하는 데 쓴다.
 *
 * 이번 호출에서 새로 생성한 경우에만 createdSettlementId 가 채워진다 —
 * 호출자가 감사 로그의 settlementId 로 쓴다.
 */
export async function ensureSettlementForApplication(
  prisma: PrismaService,
  applicationId: string,
  /** 운영자가 승인하며 영수증과 대조해 조정한 가구매 환급액. 조정하지 않았으면 생략. */
  productRefundOverride?: number | null,
): Promise<{ autoCompleted: boolean; createdSettlementId: string | null }> {
  const application = await prisma.campaignApplication.findUnique({
    where: { id: applicationId },
    select: {
      submissionReviewStatus: true,
      subTypes: true,
      actualPaymentJpy: true,
      options: { select: { subType: true, option: true } },
      posts: { select: { subType: true, insightSubmittedAt: true } },
      settlement: { select: { id: true } },
      influencer: {
        select: {
          bankAccount: {
            select: {
              bankCountry: true,
              bankCode: true,
              bankName: true,
              branchName: true,
              branchCode: true,
              accountNumber: true,
              accountHolder: true,
              invoiceRegistrationNumber: true,
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
  if (!application) return { autoCompleted: false, createdSettlementId: null };
  if (application.submissionReviewStatus !== "APPROVED") {
    return { autoCompleted: false, createdSettlementId: null };
  }
  // 이미 정산이 생성돼 있으면 그대로 둔다 (멱등).
  if (application.settlement) {
    return { autoCompleted: false, createdSettlementId: null };
  }

  const { campaign } = application;

  if (campaign.category === "SNS" && insightMissingForSettlement(application)) {
    return { autoCompleted: false, createdSettlementId: null };
  }

  const { rewardAmountJpy, productRefundJpy } = settlementAmounts(
    campaign,
    application.subTypes,
    application.options,
    {
      actualPaymentJpy: application.actualPaymentJpy,
      override: productRefundOverride,
    },
  );
  const amountJpy = rewardAmountJpy + productRefundJpy;
  // 총액 0원이면 정산 대기를 거치지 않고 즉시 완료 (캠페인 종료).
  const autoCompleted = amountJpy === 0;

  // 정산 대기풀 진입 시점의 계좌를 스냅샷 — 이후 마이페이지에서 계좌를 바꿔도
  // 이 정산 건의 입금 계좌 기록은 보존된다.
  const bankSnapshot = application.influencer.bankAccount ?? {
    bankCountry: null,
    bankCode: null,
    bankName: null,
    branchName: null,
    branchCode: null,
    accountNumber: null,
    accountHolder: null,
    invoiceRegistrationNumber: null,
  };

  const now = new Date();
  const created = await prisma.settlement.upsert({
    where: { applicationId },
    create: {
      applicationId,
      amountJpy,
      rewardAmountJpy,
      productRefundJpy,
      status: autoCompleted ? "COMPLETED" : "PENDING",
      completedAt: autoCompleted ? now : null,
      ...bankSnapshot,
    },
    update: {},
    select: { id: true },
  });
  // 0엔 정산은 생성 즉시 완료 = 캠페인 종료. 응모 상태도 함께 넘긴다.
  if (autoCompleted) {
    await markApplicationsCompleted(prisma, [applicationId], now);
  }
  return { autoCompleted, createdSettlementId: created.id };
}
