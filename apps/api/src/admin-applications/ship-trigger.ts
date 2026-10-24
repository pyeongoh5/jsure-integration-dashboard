import type { LineTriggerKey } from "@jsure/shared";

/**
 * 발송 안내 트리거 선택 (요건: 송장 유무에 따른 분기).
 *
 * - A 배송 시작 + 송장 있음 → 기존 발송 안내
 * - B 배송 시작 + 송장 없음 → 송장 준비 중 안내 (출고 사실만 먼저)
 * - C 사후 등록(비어 있다가 처음 채움) → 송장번호 안내
 * - 이미 있던 번호의 정정은 알림을 보내지 않는다 — 고칠 때마다 알림이 가면
 *   인플루언서가 혼란스럽다.
 */
export function shipTriggerKey(input: {
  category: "SNS" | "SIMPLE_REVIEW";
  /** 이미 SHIPPED 인 건에 번호만 넣는 경우 */
  isLateTrackingEntry: boolean;
  /** 요청 이전에 저장돼 있던 번호가 있었는지 */
  hadTrackingNumber: boolean;
  /** 이번 요청으로 번호가 채워지는지 */
  hasTrackingNumber: boolean;
}): LineTriggerKey | null {
  const prefix = input.category === "SIMPLE_REVIEW" ? "SIMPLE_REVIEW" : "SNS";

  if (input.isLateTrackingEntry) {
    if (input.hadTrackingNumber) return null; // 정정 — 알림 없음
    return `${prefix}_APPLICATION_TRACKING_REGISTERED` as LineTriggerKey;
  }
  return input.hasTrackingNumber
    ? (`${prefix}_APPLICATION_SHIPPED` as LineTriggerKey)
    : (`${prefix}_APPLICATION_SHIPPED_TRACKING_PENDING` as LineTriggerKey);
}
