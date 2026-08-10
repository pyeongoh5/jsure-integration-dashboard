/**
 * 감사 로그 metadata 키의 한국어 표시명. 부분 매핑이다 — 미등록 키는 원문을
 * 그대로 보여준다. 전체 키 필수 Record 로 만들면 백엔드가 metadata 키를 추가할
 * 때마다 프론트 빌드가 깨지는데, metadata 는 자유 형식이라 그 결합이 부적절하다.
 */
export const METADATA_KEY_LABEL: Record<string, string> = {
  reason: "사유",
  trackingCarrier: "택배사",
  trackingNumber: "운송장",
  amountJpy: "금액",
  batchSize: "일괄 건수",
  autoCompleted: "자동완료",
  previousStatus: "이전 상태",
  previousReviewerId: "이전 검토자",
  triggeredBy: "유발",
  changedFields: "변경 필드",
  title: "제목",
  category: "카테고리",
  publishState: "발행 상태",
  hardDeleted: "물리 삭제",
  memoId: "메모 ID",
  subTypes: "서브타입",
  previousFlaggedById: "이전 설정자",
};
