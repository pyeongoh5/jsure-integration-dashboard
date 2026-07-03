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
  COMPLETED: t("application.stageLabel.COMPLETED"),
  SETTLED: t("application.stageLabel.SETTLED"),
  REJECTED: t("application.stageLabel.REJECTED"),
  CANCELLED: t("application.stageLabel.CANCELLED"),
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
