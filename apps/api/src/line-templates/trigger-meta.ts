import type { CampaignCategory, LineTriggerKey, TriggerVariable } from "@jsure/shared";
import type {
  CampaignApplication,
  Campaign,
  CampaignRecruit,
  Influencer,
  Settlement,
  SubmittedPost,
  SubmittedPostRejection,
} from "@prisma/client";

export type ApplicationWithRels = CampaignApplication & {
  campaign: Pick<
    Campaign,
    "id" | "title" | "postingPeriodDays" | "rewardJpy" | "productSummary" | "category"
  >;
  influencer: Pick<Influencer, "id" | "name" | "lineUserId">;
};

export type DispatchContext = {
  application: ApplicationWithRels;
  post?: SubmittedPost | null;
  rejection?: SubmittedPostRejection | null;
  settlement?: Settlement | null;
  recruit?: CampaignRecruit | null;
  extra?: {
    resubmitDeadlineAt?: Date;
    finalDeadlineAt?: Date;
    remainingDays?: number;
  };
};

export type TriggerVariableWithResolver = TriggerVariable & {
  resolver: (ctx: DispatchContext) => string | null;
};

export type TriggerMetaEntry = {
  category: CampaignCategory;
  variables: TriggerVariableWithResolver[];
};

/**
 * Prisma include 형태 상수. 디스패치 컨텍스트에 필요한 캠페인/인플루언서 필드를
 * 5개 이상의 호출부에서 동일하게 사용하도록 하나의 상수로 통일한다.
 */
export const DISPATCH_APPLICATION_INCLUDE = {
  campaign: {
    select: {
      id: true,
      title: true,
      postingPeriodDays: true,
      rewardJpy: true,
      productSummary: true,
      category: true,
    },
  },
  influencer: {
    select: {
      id: true,
      name: true,
      lineUserId: true,
    },
  },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function formatJstMonthDay(d: Date): string {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return `${month}月${day}日`;
}

function formatJpy(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(n);
}

const influencerName: TriggerVariableWithResolver = {
  key: "influencerName",
  label: "인플루언서 이름",
  description: "신청자 인플루언서의 이름",
  sample: "山田花子",
  resolver: (ctx) => ctx.application.influencer.name ?? "",
};

const campaignTitle: TriggerVariableWithResolver = {
  key: "campaignTitle",
  label: "캠페인 제목",
  description: "신청한 캠페인의 제목",
  sample: "夏のコスメPRキャンペーン",
  resolver: (ctx) => ctx.application.campaign.title,
};

const campaignRewardJpy: TriggerVariableWithResolver = {
  key: "campaignRewardJpy",
  label: "보수액(엔)",
  description: "캠페인 보수 금액 (엔, 쉼표 포함)",
  sample: "15,000",
  resolver: (ctx) => formatJpy(ctx.application.campaign.rewardJpy),
};

const campaignPostingPeriodDays: TriggerVariableWithResolver = {
  key: "campaignPostingPeriodDays",
  label: "게시 기간(일)",
  description: "상품 수령 후 게시까지 허용 일수",
  sample: "7",
  resolver: (ctx) => String(ctx.application.campaign.postingPeriodDays),
};

const campaignProductSummary: TriggerVariableWithResolver = {
  key: "campaignProductSummary",
  label: "상품 요약",
  description: "캠페인 상품 간단 설명",
  sample: "新発売のフェイスマスク",
  resolver: (ctx) => ctx.application.campaign.productSummary ?? "",
};

const trackingCarrier: TriggerVariableWithResolver = {
  key: "trackingCarrier",
  label: "배송업체",
  description: "발송 시 등록한 배송업체명",
  sample: "ヤマト運輸",
  resolver: (ctx) => ctx.application.trackingCarrier ?? "",
};

const trackingNumber: TriggerVariableWithResolver = {
  key: "trackingNumber",
  label: "추적번호",
  description: "배송업체에서 제공한 추적번호",
  sample: "1234-5678-9012",
  resolver: (ctx) => ctx.application.trackingNumber ?? "",
};

const applicationShippedDate: TriggerVariableWithResolver = {
  key: "applicationShippedDate",
  label: "발송일",
  description: "상품이 발송된 날짜 (JST 월/일)",
  sample: "7月10日",
  resolver: (ctx) =>
    ctx.application.shippedAt ? formatJstMonthDay(ctx.application.shippedAt) : "",
};

const applicationDeliveredDate: TriggerVariableWithResolver = {
  key: "applicationDeliveredDate",
  label: "배송완료일",
  description: "상품이 배송 완료된 날짜 (JST)",
  sample: "7月12日",
  resolver: (ctx) =>
    ctx.application.deliveredAt ? formatJstMonthDay(ctx.application.deliveredAt) : "",
};

const applicationReceivedDate: TriggerVariableWithResolver = {
  key: "applicationReceivedDate",
  label: "수령일",
  description: "인플루언서가 수령 확인한 날짜 (JST)",
  sample: "7月13日",
  resolver: (ctx) =>
    ctx.application.receivedAt ? formatJstMonthDay(ctx.application.receivedAt) : "",
};

const postingDeadline: TriggerVariableWithResolver = {
  key: "postingDeadline",
  label: "게시 마감일",
  description: "수령일로부터 계산된 게시 마감일 (JST)",
  sample: "7月20日",
  resolver: (ctx) => {
    if (!ctx.application.receivedAt) return "";
    const deadline = new Date(
      ctx.application.receivedAt.getTime() + ctx.application.campaign.postingPeriodDays * DAY_MS,
    );
    return formatJstMonthDay(deadline);
  },
};

const rejectReason: TriggerVariableWithResolver = {
  key: "rejectReason",
  label: "반려 사유",
  description: "관리자가 입력한 반려 코멘트",
  sample: "必須ハッシュタグを追加してください",
  resolver: (ctx) => ctx.rejection?.comment ?? "",
};

const resubmitDeadline: TriggerVariableWithResolver = {
  key: "resubmitDeadline",
  label: "재제출 기한",
  description: "반려 후 재제출 마감일 (JST)",
  sample: "7月20日",
  resolver: (ctx) =>
    ctx.extra?.resubmitDeadlineAt ? formatJstMonthDay(ctx.extra.resubmitDeadlineAt) : "",
};

const finalDeadline: TriggerVariableWithResolver = {
  key: "finalDeadline",
  label: "최종 기한",
  description: "반려 리마인더의 최종 기한 (JST)",
  sample: "7月21日",
  resolver: (ctx) =>
    ctx.extra?.finalDeadlineAt ? formatJstMonthDay(ctx.extra.finalDeadlineAt) : "",
};

const remainingDays: TriggerVariableWithResolver = {
  key: "remainingDays",
  label: "남은 일수",
  description: "게시 마감까지 남은 일수",
  sample: "3",
  resolver: (ctx) => (ctx.extra?.remainingDays != null ? String(ctx.extra.remainingDays) : ""),
};

const rewardJpy: TriggerVariableWithResolver = {
  key: "rewardJpy",
  label: "정산 금액(엔)",
  description: "정산 금액 (엔, 쉼표 포함)",
  sample: "15,000",
  resolver: (ctx) => (ctx.settlement ? formatJpy(ctx.settlement.amountJpy) : ""),
};

function subTypeLabel(value: string): string {
  switch (value) {
    case "INSTAGRAM":
      return "Instagram";
    case "TIKTOK":
      return "TikTok";
    case "X":
      return "X";
    case "YOUTUBE":
      return "YouTube";
    case "QOO10":
      return "Qoo10";
    case "LIPS":
      return "LIPS";
    case "ATCOSME":
      return "@cosme";
    default:
      return value;
  }
}

const subType: TriggerVariableWithResolver = {
  key: "subType",
  label: "서브타입",
  description: "応募したプラットフォームの表示ラベル",
  sample: "Qoo10",
  resolver: (ctx) => subTypeLabel(ctx.application.subType),
};

const productPriceJpy: TriggerVariableWithResolver = {
  key: "productPriceJpy",
  label: "상품가격(엔)",
  description: "サブタイプごとの商品価格 (エン、カンマ入り)",
  sample: "3,000",
  resolver: (ctx) =>
    ctx.recruit?.productPriceJpy != null ? formatJpy(ctx.recruit.productPriceJpy) : "",
};

const productUrl: TriggerVariableWithResolver = {
  key: "productUrl",
  label: "상품 URL",
  description: "商品ページのリンク",
  sample: "https://qoo10.jp/g/...",
  resolver: (ctx) => ctx.recruit?.productUrl ?? "",
};

const totalSettlementJpy: TriggerVariableWithResolver = {
  key: "totalSettlementJpy",
  label: "정산 예상액(엔)",
  description: "報酬 + 商品価格 の合計 (エン、カンマ入り)",
  sample: "8,000",
  resolver: (ctx) => {
    const price = ctx.recruit?.productPriceJpy ?? 0;
    return formatJpy(ctx.application.campaign.rewardJpy + price);
  },
};

const orderNumber: TriggerVariableWithResolver = {
  key: "orderNumber",
  label: "주문번호",
  description: "インフルエンサーが提出した注文番号",
  sample: "ORD-20260703-0001",
  resolver: (ctx) => ctx.application.orderNumber ?? "",
};

const orderSubmittedDate: TriggerVariableWithResolver = {
  key: "orderSubmittedDate",
  label: "주문 제출일",
  description: "注文情報を提出した日 (JST 月日)",
  sample: "7月3日",
  resolver: (ctx) =>
    ctx.application.orderSubmittedAt ? formatJstMonthDay(ctx.application.orderSubmittedAt) : "",
};

const reviewDeadline: TriggerVariableWithResolver = {
  key: "reviewDeadline",
  label: "리뷰 마감일",
  description: "レビュー提出期限 (orderSubmittedAt + postingPeriodDays)",
  sample: "7月17日",
  resolver: (ctx) => {
    if (!ctx.application.orderSubmittedAt) return "";
    const deadline = new Date(
      ctx.application.orderSubmittedAt.getTime() +
        ctx.application.campaign.postingPeriodDays * DAY_MS,
    );
    return formatJstMonthDay(deadline);
  },
};

const reviewUrl: TriggerVariableWithResolver = {
  key: "reviewUrl",
  label: "리뷰 URL",
  description: "提出されたレビューURL",
  sample: "https://www.cosme.net/...",
  resolver: (ctx) => ctx.post?.url ?? "",
};

const BASE_VARS: TriggerVariableWithResolver[] = [
  influencerName,
  campaignTitle,
  campaignRewardJpy,
  campaignPostingPeriodDays,
  campaignProductSummary,
];

function withBase(...extra: TriggerVariableWithResolver[]): TriggerVariableWithResolver[] {
  return [...BASE_VARS, ...extra];
}

export const TRIGGER_META: Record<LineTriggerKey, TriggerMetaEntry> = {
  SNS_APPLICATION_APPLIED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_APPLICATION_APPROVED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_APPLICATION_REJECTED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_APPLICATION_SHIPPED: {
    category: "SNS",
    variables: withBase(trackingCarrier, trackingNumber, applicationShippedDate),
  },
  SNS_APPLICATION_DELIVERED: {
    category: "SNS",
    variables: withBase(
      trackingCarrier,
      trackingNumber,
      applicationShippedDate,
      applicationDeliveredDate,
    ),
  },
  SNS_APPLICATION_RECEIPT_CONFIRMED: {
    category: "SNS",
    variables: withBase(applicationDeliveredDate, applicationReceivedDate, postingDeadline),
  },
  SNS_POST_SUBMITTED: {
    category: "SNS",
    variables: withBase(applicationReceivedDate, postingDeadline),
  },
  SNS_POST_DEADLINE_REMINDER: {
    category: "SNS",
    variables: withBase(remainingDays, postingDeadline),
  },
  SNS_POST_APPROVED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_POST_REJECTED: {
    category: "SNS",
    variables: withBase(rejectReason, resubmitDeadline),
  },
  SNS_POST_REJECTION_REMINDER: {
    category: "SNS",
    variables: withBase(rejectReason, finalDeadline),
  },
  SNS_INSIGHT_SUBMITTED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_INSIGHT_APPROVED: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_INSIGHT_REMINDER: {
    category: "SNS",
    variables: withBase(),
  },
  SNS_SETTLEMENT_COMPLETED: {
    category: "SNS",
    variables: withBase(rewardJpy),
  },
  SNS_CAMPAIGN_COMPLETED: {
    category: "SNS",
    variables: withBase(),
  },
  FAKE_PURCHASE_APPLICATION_APPLIED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, productPriceJpy, productUrl, totalSettlementJpy),
  },
  FAKE_PURCHASE_APPLICATION_APPROVED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, productPriceJpy, productUrl, totalSettlementJpy),
  },
  FAKE_PURCHASE_APPLICATION_REJECTED: {
    category: "FAKE_PURCHASE",
    variables: withBase(rejectReason),
  },
  FAKE_PURCHASE_ORDER_SUBMITTED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, orderNumber, orderSubmittedDate, reviewDeadline),
  },
  FAKE_PURCHASE_REVIEW_SUBMITTED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, reviewUrl),
  },
  FAKE_PURCHASE_REVIEW_APPROVED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, reviewUrl, totalSettlementJpy),
  },
  FAKE_PURCHASE_REVIEW_REJECTED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, reviewUrl, rejectReason),
  },
  FAKE_PURCHASE_REVIEW_DEADLINE_REMINDER: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, reviewDeadline, remainingDays),
  },
  FAKE_PURCHASE_SETTLEMENT_COMPLETED: {
    category: "FAKE_PURCHASE",
    variables: withBase(subType, totalSettlementJpy),
  },
  FAKE_PURCHASE_CAMPAIGN_COMPLETED: {
    category: "FAKE_PURCHASE",
    variables: withBase(),
  },
  SIMPLE_REVIEW_APPLICATION_APPLIED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType),
  },
  SIMPLE_REVIEW_APPLICATION_APPROVED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, postingDeadline),
  },
  SIMPLE_REVIEW_APPLICATION_REJECTED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, rejectReason),
  },
  SIMPLE_REVIEW_APPLICATION_SHIPPED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, trackingCarrier, trackingNumber, applicationShippedDate),
  },
  SIMPLE_REVIEW_APPLICATION_DELIVERED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(
      subType,
      trackingCarrier,
      trackingNumber,
      applicationShippedDate,
      applicationDeliveredDate,
    ),
  },
  SIMPLE_REVIEW_APPLICATION_RECEIPT_CONFIRMED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, applicationDeliveredDate, applicationReceivedDate, postingDeadline),
  },
  SIMPLE_REVIEW_SUBMITTED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, reviewUrl),
  },
  SIMPLE_REVIEW_APPROVED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, reviewUrl),
  },
  SIMPLE_REVIEW_REJECTED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, reviewUrl, rejectReason, resubmitDeadline),
  },
  SIMPLE_REVIEW_DEADLINE_REMINDER: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, remainingDays, postingDeadline),
  },
  SIMPLE_REVIEW_REJECTION_REMINDER: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, rejectReason, finalDeadline),
  },
  SIMPLE_REVIEW_SETTLEMENT_COMPLETED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType, rewardJpy),
  },
  SIMPLE_REVIEW_CAMPAIGN_COMPLETED: {
    category: "SIMPLE_REVIEW",
    variables: withBase(subType),
  },
};

export function getMeta(triggerKey: LineTriggerKey): TriggerMetaEntry {
  return TRIGGER_META[triggerKey];
}

export function listTriggersForCategory(category: CampaignCategory): LineTriggerKey[] {
  return (Object.keys(TRIGGER_META) as LineTriggerKey[]).filter(
    (k) => TRIGGER_META[k].category === category,
  );
}

export function publicVariables(triggerKey: LineTriggerKey): TriggerVariable[] {
  return TRIGGER_META[triggerKey].variables.map(({ resolver: _resolver, ...rest }) => rest);
}
