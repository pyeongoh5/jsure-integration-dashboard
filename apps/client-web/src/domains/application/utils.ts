import {
  SUB_TYPE_LABEL,
  type ApplicationDisplayStage,
  type CampaignCategory,
  type CampaignSubType,
} from "@jsure/shared";
import { t } from "@i18n";

export const STAGE_LABEL: Record<ApplicationDisplayStage, string> = {
  APPLIED: t("application.stageLabel.APPLIED"),
  APPROVED: t("application.stageLabel.APPROVED"),
  SHIPPED: t("application.stageLabel.SHIPPED"),
  AWAITING_RECEIPT: t("application.stageLabel.AWAITING_RECEIPT"),
  POSTING: t("application.stageLabel.POSTING"),
  POSTED: t("application.stageLabel.POSTED"),
  POST_REJECTED: t("application.stageLabel.POST_REJECTED"),
  INSIGHT_DUE: t("application.stageLabel.INSIGHT_DUE"),
  REVIEWING: t("application.stageLabel.REVIEWING"),
  COMPLETED: t("application.stageLabel.COMPLETED"),
  SETTLED: t("application.stageLabel.SETTLED"),
  REJECTED: t("application.stageLabel.REJECTED"),
  CANCELLED: t("application.stageLabel.CANCELLED"),
  AWAITING_ORDER: t("application.stage.awaitingOrder.heading"),
  AWAITING_REVIEW: t("application.stage.awaitingReview.heading"),
  REVIEW_PENDING: t("application.stageLabel.REVIEWING"),
  REVIEW_REJECTED: t("application.stage.reviewRejected.heading"),
};

export const STAGE_VARIANT: Record<ApplicationDisplayStage, string> = {
  APPLIED: "neutral",
  APPROVED: "info",
  SHIPPED: "warn",
  AWAITING_RECEIPT: "warn",
  POSTING: "info",
  POSTED: "info",
  POST_REJECTED: "danger",
  INSIGHT_DUE: "warn",
  REVIEWING: "neutral",
  COMPLETED: "ok",
  SETTLED: "ok",
  REJECTED: "danger",
  CANCELLED: "danger",
  AWAITING_ORDER: "info",
  AWAITING_REVIEW: "warn",
  REVIEW_PENDING: "neutral",
  REVIEW_REJECTED: "danger",
};

// SNS / FAKE_PURCHASE 카테고리용 매핑 (기존 8스텝 스테퍼 대상).
const STAGE_PROGRESS_DEFAULT: Record<ApplicationDisplayStage, number> = {
  APPLIED: 1,
  APPROVED: 2,
  SHIPPED: 3,
  AWAITING_RECEIPT: 4,
  POSTING: 5,
  POSTED: 5,
  POST_REJECTED: 5,
  INSIGHT_DUE: 5,
  REVIEWING: 6,
  COMPLETED: 7,
  SETTLED: 8,
  REJECTED: 0,
  CANCELLED: 0,
  AWAITING_ORDER: 3,
  AWAITING_REVIEW: 5,
  REVIEW_PENDING: 6,
  REVIEW_REJECTED: 5,
};

// SIMPLE_REVIEW 카테고리용 매핑 (8스텝: 응모/승인/발송/수령확인/리뷰제출/검수/정산대기/캠페인종료).
const STAGE_PROGRESS_SIMPLE_REVIEW: Record<ApplicationDisplayStage, number> = {
  APPLIED: 1,
  APPROVED: 2,
  SHIPPED: 3,
  AWAITING_RECEIPT: 4,
  AWAITING_REVIEW: 5, // 수령 후 리뷰 제출 대기
  REVIEW_REJECTED: 5,
  REVIEW_PENDING: 6, // 리뷰 제출됨, 검수 대기
  REVIEWING: 6,
  COMPLETED: 7, // 검수 승인 후 정산 대기
  SETTLED: 8, // 정산 완료(캠페인 종료)
  POSTING: 0,
  POSTED: 0,
  POST_REJECTED: 0,
  INSIGHT_DUE: 0,
  REJECTED: 0,
  CANCELLED: 0,
  AWAITING_ORDER: 0,
};

export function stageProgressFor(
  category: CampaignCategory,
  stage: ApplicationDisplayStage,
): number {
  const table =
    category === "SIMPLE_REVIEW"
      ? STAGE_PROGRESS_SIMPLE_REVIEW
      : STAGE_PROGRESS_DEFAULT;
  return table[stage];
}

// 카테고리별 스텝 총 개수. 스테퍼 렌더링용.
export function stageTotalFor(_category: CampaignCategory): number {
  return 8;
}

/** 서브타입 옵션 표시명. 지금은 인스타그램 피드/릴스만 있다. */
const SUB_TYPE_OPTION_LABEL: Record<string, string> = {
  FEED: t("campaign.card.instagramFeed"),
  REELS: t("campaign.card.instagramReels"),
};

/**
 * 응모가 참여하는 서브타입 태그 — 선택 옵션이 있으면 함께 보여준다.
 * 목록 카드와 상세가 같은 표기를 쓰도록 한 곳에서 만든다.
 */
export function applicationSubTypeTags(application: {
  subTypes: CampaignSubType[];
  selectedOptions: { subType: CampaignSubType; option: string }[];
}): { subType: CampaignSubType; label: string }[] {
  return application.subTypes.map((subType) => {
    const selected = application.selectedOptions.find(
      (entry) => entry.subType === subType,
    );
    if (!selected) return { subType, label: SUB_TYPE_LABEL[subType] };
    const optionLabel = SUB_TYPE_OPTION_LABEL[selected.option] ?? selected.option;
    return { subType, label: `${SUB_TYPE_LABEL[subType]} - ${optionLabel}` };
  });
}

/** @deprecated 카테고리 인지가 필요 없는 옛 호출용. stageProgressFor 사용 권장. */
export const STAGE_PROGRESS = STAGE_PROGRESS_DEFAULT;
/** @deprecated stageTotalFor 사용 권장. */
export const STAGE_TOTAL = 8;
