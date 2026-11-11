import { z } from "zod";

/** 탈퇴 사유 대분류. 신청 폼의 라디오 선택지이자 이탈 사유 집계의 축이다. */
export const WithdrawalReasonSchema = z.enum([
  "NOT_ENOUGH_CAMPAIGNS",
  "GUIDELINE_BURDEN",
  "REWARD_UNSATISFIED",
  "USING_OTHER_PLATFORM",
  "SNS_INACTIVE",
  "OTHER",
]);
export type WithdrawalReason = z.infer<typeof WithdrawalReasonSchema>;

/** 라디오 버튼 노출 순서. 화면이 enum 순서에 의존하지 않도록 명시한다. */
export const WITHDRAWAL_REASON_ORDER: WithdrawalReason[] = [
  "NOT_ENOUGH_CAMPAIGNS",
  "GUIDELINE_BURDEN",
  "REWARD_UNSATISFIED",
  "USING_OTHER_PLATFORM",
  "SNS_INACTIVE",
  "OTHER",
];

export const WithdrawalDecisionSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
export type WithdrawalDecision = z.infer<typeof WithdrawalDecisionSchema>;

/** 상세 사유 입력 상한. 화면 카운터와 서버 검증이 같은 값을 본다. */
export const WITHDRAWAL_REASON_DETAIL_MAX = 500;

/** 반려 사유 입력 상한. */
export const WITHDRAWAL_REJECT_REASON_MAX = 500;

/**
 * 탈퇴 승인 시점의 SNS 보유 현황 1건.
 *
 * 승인 처리가 InfluencerSnsAccount 를 지우므로, 채널별 이탈 분석을 하려면
 * 지우기 전에 떠둬야 한다. 개인을 특정할 수 없도록 핸들은 담지 않는다 —
 * 탈퇴는 PII 익명화이고, 핸들은 그 자체로 개인 식별자다.
 */
export const WithdrawalSnsSnapshotEntrySchema = z.object({
  snsType: z.string(),
  followerCount: z.number().int().nonnegative(),
});
export type WithdrawalSnsSnapshotEntry = z.infer<
  typeof WithdrawalSnsSnapshotEntrySchema
>;

export const WithdrawalSnsSnapshotSchema = z.array(
  WithdrawalSnsSnapshotEntrySchema,
);
export type WithdrawalSnsSnapshot = z.infer<typeof WithdrawalSnsSnapshotSchema>;

export const CreateWithdrawalRequestSchema = z.object({
  reason: WithdrawalReasonSchema,
  reasonDetail: z.string().max(WITHDRAWAL_REASON_DETAIL_MAX).default(""),
});
export type CreateWithdrawalRequest = z.infer<
  typeof CreateWithdrawalRequestSchema
>;

export const RejectWithdrawalRequestSchema = z.object({
  rejectReason: z.string().trim().min(1).max(WITHDRAWAL_REJECT_REASON_MAX),
});
export type RejectWithdrawalRequest = z.infer<
  typeof RejectWithdrawalRequestSchema
>;

/**
 * 탈퇴 신청 1건. 반려되면 다시 신청할 수 있어 인플루언서당 여러 건이 쌓이고,
 * 처리 내역은 영구 보존한다.
 */
export const InfluencerWithdrawalSchema = z.object({
  id: z.string(),
  reason: WithdrawalReasonSchema,
  reasonDetail: z.string(),
  decision: WithdrawalDecisionSchema,
  requestedAt: z.string().datetime({ offset: true }),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  /** 승인·반려를 처리한 관리자 이름. 계정이 지워졌으면 null. */
  decidedByName: z.string().nullable(),
  rejectReason: z.string().nullable(),
});
export type InfluencerWithdrawal = z.infer<typeof InfluencerWithdrawalSchema>;

/** 신청을 막는 응모 1건 — 화면이 캠페인명을 그대로 안내 문구에 넣는다. */
export const WithdrawalBlockingApplicationSchema = z.object({
  applicationId: z.string(),
  campaignTitle: z.string(),
});
export type WithdrawalBlockingApplication = z.infer<
  typeof WithdrawalBlockingApplicationSchema
>;

/** 탈퇴 안내 화면이 한 번에 받는 상태. 신청 가능 여부와 그 근거를 모두 담는다. */
export const WithdrawalEligibilityResponseSchema = z.object({
  /** blockingApplications 가 비어 있고 대기 중인 신청도 없을 때만 true. */
  eligible: z.boolean(),
  /** 진행 중이라 탈퇴를 막는 응모. */
  blockingApplications: z.array(WithdrawalBlockingApplicationSchema),
  /** 신청하면 자동 취소될 심사 중(APPLIED) 응모. */
  autoCancelApplications: z.array(WithdrawalBlockingApplicationSchema),
  /** 가장 최근 신청 1건. 대기 중이거나 직전에 반려된 건을 화면이 배너로 보여준다. */
  latest: InfluencerWithdrawalSchema.nullable(),
});
export type WithdrawalEligibilityResponse = z.infer<
  typeof WithdrawalEligibilityResponseSchema
>;
