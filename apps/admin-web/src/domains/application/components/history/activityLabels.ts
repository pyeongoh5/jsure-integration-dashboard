import type { AdminActivityAction, AdminActivityOrigin } from "@jsure/shared";

/**
 * 전체 키가 필수인 Record — 액션을 추가하면 여기 라벨 누락을 typecheck 가 잡는다.
 */
export const ACTIVITY_ACTION_LABEL: Record<AdminActivityAction, string> = {
  APPLICATION_APPROVE: "응모 승인",
  APPLICATION_REJECT: "응모 거절",
  APPLICATION_REVIEW_UNDO: "응모 검토 취소",
  APPLICATION_SHIP: "택배 발송",
  APPLICATION_DELIVER: "배송 완료",
  SUBMISSION_APPROVE: "제출물 승인",
  SUBMISSION_REJECT: "제출물 반려",
  SUBMISSION_REVIEW_UNDO: "제출물 검토 취소",
  SETTLEMENT_CREATE: "정산 생성",
  SETTLEMENT_REGISTER: "정산 등록",
  SETTLEMENT_COMPLETE: "정산 완료",
  SETTLEMENT_AUTO_COMPLETE: "정산 자동 완료",
  CAMPAIGN_CREATE: "캠페인 생성",
  CAMPAIGN_UPDATE: "캠페인 수정",
  CAMPAIGN_CLOSE: "캠페인 종료",
  CAMPAIGN_HIDE: "캠페인 비공개",
  CAMPAIGN_UNHIDE: "캠페인 공개",
  CAMPAIGN_DELETE: "캠페인 삭제",
  CAMPAIGN_DRAFT_CREATE: "임시저장 생성",
  CAMPAIGN_DRAFT_UPDATE: "임시저장 수정",
  CAMPAIGN_DRAFT_PUBLISH: "임시저장 발행",
  INFLUENCER_MEMO_CREATE: "인플루언서 메모 작성",
  INFLUENCER_FLAG_SET: "인플루언서 플래그 설정",
  INFLUENCER_FLAG_CLEAR: "인플루언서 플래그 해제",
};

/** ADMIN 은 기본값이라 배지를 달지 않는다. */
export const ACTIVITY_ORIGIN_BADGE: Record<AdminActivityOrigin, string | null> =
  {
    ADMIN: null,
    CASCADE: "연쇄",
    SYSTEM: "시스템",
  };
