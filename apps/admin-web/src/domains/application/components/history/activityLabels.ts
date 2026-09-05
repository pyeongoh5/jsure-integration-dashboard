import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminActivityAction, AdminActivityOrigin } from "@jsure/shared";

/**
 * 전체 키가 필수인 Record — 액션을 추가하면 여기 라벨 누락을 typecheck 가 잡는다.
 * 값은 i18n 키 — 표시 시점에 컴포넌트에서 t(...) 로 번역한다.
 */
export const ACTIVITY_ACTION_LABEL: Record<
  AdminActivityAction,
  AdminTranslationKey
> = {
  APPLICATION_APPROVE: "domains.application.history.actions.applicationApprove",
  APPLICATION_REJECT: "domains.application.history.actions.applicationReject",
  APPLICATION_REVIEW_UNDO:
    "domains.application.history.actions.applicationReviewUndo",
  APPLICATION_SHIP: "domains.application.history.actions.applicationShip",
  APPLICATION_DELIVER: "domains.application.history.actions.applicationDeliver",
  SUBMISSION_APPROVE: "domains.application.history.actions.submissionApprove",
  SUBMISSION_REJECT: "domains.application.history.actions.submissionReject",
  SUBMISSION_REVIEW_UNDO:
    "domains.application.history.actions.submissionReviewUndo",
  SUBMISSION_INSIGHT_UPDATE:
    "domains.application.history.actions.submissionInsightUpdate",
  SETTLEMENT_CREATE: "domains.application.history.actions.settlementCreate",
  SETTLEMENT_REGISTER: "domains.application.history.actions.settlementRegister",
  SETTLEMENT_COMPLETE: "domains.application.history.actions.settlementComplete",
  SETTLEMENT_AUTO_COMPLETE:
    "domains.application.history.actions.settlementAutoComplete",
  CAMPAIGN_CREATE: "domains.application.history.actions.campaignCreate",
  CAMPAIGN_UPDATE: "domains.application.history.actions.campaignUpdate",
  CAMPAIGN_CLOSE: "domains.application.history.actions.campaignClose",
  CAMPAIGN_HIDE: "domains.application.history.actions.campaignHide",
  CAMPAIGN_UNHIDE: "domains.application.history.actions.campaignUnhide",
  CAMPAIGN_BUMP: "domains.application.history.actions.campaignBump",
  CAMPAIGN_DELETE: "domains.application.history.actions.campaignDelete",
  CAMPAIGN_DRAFT_CREATE:
    "domains.application.history.actions.campaignDraftCreate",
  CAMPAIGN_DRAFT_UPDATE:
    "domains.application.history.actions.campaignDraftUpdate",
  CAMPAIGN_DRAFT_PUBLISH:
    "domains.application.history.actions.campaignDraftPublish",
  APPLICATION_APPLY: "domains.application.history.actions.applicationApply",
  APPLICATION_ORDER_SUBMIT:
    "domains.application.history.actions.applicationOrderSubmit",
  APPLICATION_RECEIVE_CONFIRM:
    "domains.application.history.actions.applicationReceiveConfirm",
  POST_SUBMIT: "domains.application.history.actions.postSubmit",
  INSIGHT_SUBMIT: "domains.application.history.actions.insightSubmit",
  INFLUENCER_MEMO_CREATE:
    "domains.application.history.actions.influencerMemoCreate",
  INFLUENCER_FLAG_SET: "domains.application.history.actions.influencerFlagSet",
  INFLUENCER_FLAG_CLEAR:
    "domains.application.history.actions.influencerFlagClear",
};

/**
 * 배지는 "어드민이 직접 하지 않은 자동 처리"만 표시한다. ADMIN·INFLUENCER 는
 * 담당자 컬럼이 행위자를 말해주므로 배지가 중복이다.
 */
export const ACTIVITY_ORIGIN_BADGE: Record<
  AdminActivityOrigin,
  AdminTranslationKey | null
> = {
  ADMIN: null,
  CASCADE: "domains.application.history.originBadgeCascade",
  SYSTEM: "domains.application.history.actorSystem",
  INFLUENCER: null,
};
