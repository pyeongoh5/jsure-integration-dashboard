import type { ApplicationDisplayStage } from "@jsure/shared";
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
  COMPLETED: t("application.stageLabel.COMPLETED"), // new — 문구가 "精算待ち/정산 대기" 로 변경됨
  SETTLED: t("application.stageLabel.SETTLED"), // new — 문구가 "キャンペーン終了/캠페인 종료" 로 변경됨
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

export const STAGE_PROGRESS: Record<ApplicationDisplayStage, number> = {
  APPLIED: 1,
  APPROVED: 2,
  SHIPPED: 3,
  AWAITING_RECEIPT: 4,
  POSTING: 5,
  POSTED: 5,
  POST_REJECTED: 5,
  INSIGHT_DUE: 5, // new — 게시/인사이트 묶음으로 통일 (기존 6)
  REVIEWING: 6, // new — 검수 스텝(step6)에 정렬 (기존 7)
  COMPLETED: 7, // new — 신설 "정산 대기" 스텝 활성 (기존 8)
  SETTLED: 8, // new — 신설 "캠페인 종료" 스텝 활성 (기존 9)
  REJECTED: 0,
  CANCELLED: 0,
  AWAITING_ORDER: 3,
  AWAITING_REVIEW: 5,
  REVIEW_PENDING: 6, // new — REVIEWING 과 동일 스텝 (기존 7)
  REVIEW_REJECTED: 5,
};

export const STAGE_TOTAL = 8; // new — 스테퍼에 정산 대기/캠페인 종료 스텝을 추가 (기존 9)
