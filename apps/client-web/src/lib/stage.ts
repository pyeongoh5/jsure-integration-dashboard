import type { ApplicationDisplayStage } from "@jsure/shared";

export const STAGE_LABEL: Record<ApplicationDisplayStage, string> = {
  APPLIED: "申請済",
  APPROVED: "承認",
  SHIPPED: "発送中",
  POSTING: "投稿期間",
  POSTED: "投稿完了",
  INSIGHT_DUE: "インサイト提出",
  REVIEWING: "検査中",
  COMPLETED: "完了",
  REJECTED: "却下",
  CANCELLED: "キャンセル",
};

export const STAGE_VARIANT: Record<ApplicationDisplayStage, string> = {
  APPLIED: "neutral",
  APPROVED: "info",
  SHIPPED: "warn",
  POSTING: "info",
  POSTED: "info",
  INSIGHT_DUE: "warn",
  REVIEWING: "neutral",
  COMPLETED: "ok",
  REJECTED: "danger",
  CANCELLED: "danger",
};

export const STAGE_PROGRESS: Record<ApplicationDisplayStage, number> = {
  APPLIED: 1,
  APPROVED: 2,
  SHIPPED: 3,
  POSTING: 4,
  POSTED: 4,
  INSIGHT_DUE: 5,
  REVIEWING: 6,
  COMPLETED: 7,
  REJECTED: 0,
  CANCELLED: 0,
};

export const STAGE_TOTAL = 7;
