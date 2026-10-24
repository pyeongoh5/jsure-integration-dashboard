import type { AdminTranslationKey } from "@i18n/admin";
import { CancelReasonCategorySchema, type CancelReasonCategory } from "@jsure/shared";

export type CancelInput = {
  reasonCategory: CancelReasonCategory;
  reason: string;
};

/**
 * 취소 확정 입력을 추려낸다. 응모자 관리와 제출물 검토가 같은 다이얼로그를 쓰므로
 * 판정도 한 곳에 둔다. 상세 사유가 비면 null — 호출부가 사유 필수 에러를 띄운다.
 */
export function toCancelInput(input: unknown): CancelInput | null {
  if (typeof input !== "object" || input === null) return null;
  if (!("reasonCategory" in input) || !("reason" in input)) return null;
  const parsed = CancelReasonCategorySchema.safeParse(input.reasonCategory);
  if (!parsed.success) return null;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason === "") return null;
  return { reasonCategory: parsed.data, reason };
}

/**
 * 취소 사유 대분류 라벨. 취소 다이얼로그와 히스토리가 같은 문구를 써야 하므로
 * 매핑을 한 곳에 둔다. 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
 */
export const CANCEL_REASON_CATEGORY_LABELS: Record<
  CancelReasonCategory,
  AdminTranslationKey
> = {
  INFLUENCER_CIRCUMSTANCE:
    "domains.application.cancelReason.influencerCircumstance",
  COMMUNICATION_ISSUE: "domains.application.cancelReason.communicationIssue",
  PRODUCT_LOGISTICS_ISSUE:
    "domains.application.cancelReason.productLogisticsIssue",
  OTHER: "domains.application.cancelReason.other",
};
