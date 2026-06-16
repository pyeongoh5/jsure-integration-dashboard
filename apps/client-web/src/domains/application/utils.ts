import type { ApplicationDisplayStage } from "@jsure/shared";

export const STAGE_LABEL: Record<ApplicationDisplayStage, string> = {
  APPLIED: "応募済",
  APPROVED: "承認",
  SHIPPED: "発送中",
  AWAITING_RECEIPT: "受領確認待ち",
  POSTING: "投稿期間",
  POSTED: "投稿完了",
  POST_REJECTED: "投稿を伴う",
  INSIGHT_DUE: "インサイト提出",
  REVIEWING: "検査中",
  COMPLETED: "完了",
  SETTLED: "支払完了",
  REJECTED: "未選定",
  CANCELLED: "キャンセル",
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
};

export const STAGE_PROGRESS: Record<ApplicationDisplayStage, number> = {
  APPLIED: 1,
  APPROVED: 2,
  SHIPPED: 3,
  AWAITING_RECEIPT: 4,
  POSTING: 5,
  POSTED: 5,
  POST_REJECTED: 5,
  INSIGHT_DUE: 6,
  REVIEWING: 7,
  COMPLETED: 8,
  SETTLED: 9,
  REJECTED: 0,
  CANCELLED: 0,
};

export const STAGE_TOTAL = 9;
