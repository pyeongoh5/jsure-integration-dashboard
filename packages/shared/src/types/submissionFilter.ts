import { z } from "zod";
import { CampaignCategorySchema, type CampaignCategory } from "./campaign.js";
import {
  ApplicantMediaFilterKeySchema,
  type ApplicantMediaFilterKey,
} from "./applicantFilter.js";

/**
 * 제출물 검토 화면에 노출되는 상태.
 *
 * 정산 흐름에 들어간 건(검수 승인 + 정산 레코드 존재)은 정산 관리 페이지가 다루므로
 * 검토 화면에는 아예 나오지 않는다 — 그래서 여기에 SETTLED/SETTLEMENT_PENDING 이 없다.
 */
export const DraftViewStatusSchema = z.enum([
  "REVIEW_PENDING",
  "AWAITING_INSIGHT",
  "INSIGHT_SUBMITTED",
  "REJECTED",
  "REJECTED_LOCKED",
]);
export type DraftViewStatus = z.infer<typeof DraftViewStatusSchema>;

export type DraftViewStatusRule = {
  viewStatus: DraftViewStatus;
  /** 제출물 검수 상태. */
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  /** 모든 게시물의 인사이트가 제출됐는지. null 이면 무관. */
  insightSubmitted: boolean | null;
  /** 정산 레코드 유무. null 이면 무관. */
  hasSettlement: boolean | null;
};

/**
 * 화면 상태 판정 규칙 — 서로 배타적이라 최대 하나만 매칭된다.
 * 서버의 목록 필터(SQL)와 클라이언트의 상태 표시가 이 표 하나를 공유하므로,
 * 여기에 손대면 양쪽이 함께 바뀐다.
 *
 * 어느 규칙에도 맞지 않는 건 = 정산 흐름 진입분이고, 검토 목록에서 숨긴다.
 */
export const DRAFT_VIEW_STATUS_RULES: readonly DraftViewStatusRule[] = [
  {
    viewStatus: "REVIEW_PENDING",
    reviewStatus: "PENDING",
    insightSubmitted: null,
    hasSettlement: null,
  },
  // 반려 후 인사이트까지 제출된 건은 되돌릴 수 없어 따로 표시한다.
  {
    viewStatus: "REJECTED_LOCKED",
    reviewStatus: "REJECTED",
    insightSubmitted: true,
    hasSettlement: null,
  },
  {
    viewStatus: "REJECTED",
    reviewStatus: "REJECTED",
    insightSubmitted: false,
    hasSettlement: null,
  },
  {
    viewStatus: "INSIGHT_SUBMITTED",
    reviewStatus: "APPROVED",
    insightSubmitted: true,
    hasSettlement: false,
  },
  {
    viewStatus: "AWAITING_INSIGHT",
    reviewStatus: "APPROVED",
    insightSubmitted: false,
    hasSettlement: false,
  },
];

function matchesRule(
  rule: DraftViewStatusRule,
  input: {
    reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
    insightSubmitted: boolean;
    hasSettlement: boolean;
  },
): boolean {
  if (rule.reviewStatus !== input.reviewStatus) return false;
  if (
    rule.insightSubmitted !== null &&
    rule.insightSubmitted !== input.insightSubmitted
  ) {
    return false;
  }
  if (rule.hasSettlement !== null && rule.hasSettlement !== input.hasSettlement) {
    return false;
  }
  return true;
}

/** 화면 노출 상태. null 이면 검토 목록에서 숨기는 건(정산 흐름 진입분). */
export function deriveDraftViewStatus(input: {
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  insightSubmitted: boolean;
  hasSettlement: boolean;
}): DraftViewStatus | null {
  return (
    DRAFT_VIEW_STATUS_RULES.find((rule) => matchesRule(rule, input))
      ?.viewStatus ?? null
  );
}

/** 제출물 검토 목록 필터. 미디어 키는 응모자 관리와 같은 표를 쓴다. */
export const SubmissionFilterSchema = z.object({
  campaignId: z.string().nullable(),
  mediaKeys: z.array(ApplicantMediaFilterKeySchema),
  viewStatuses: z.array(DraftViewStatusSchema),
  category: CampaignCategorySchema.nullable(),
});
export type SubmissionFilter = z.infer<typeof SubmissionFilterSchema>;

export const EMPTY_SUBMISSION_FILTER: SubmissionFilter = {
  campaignId: null,
  mediaKeys: [],
  viewStatuses: [],
  category: null,
};

/** 필터를 쿼리스트링 파라미터로 직렬화. 파싱은 parseSubmissionFilterParams. */
export function submissionFilterToParams(
  filter: SubmissionFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.campaignId) params.campaignId = filter.campaignId;
  if (filter.mediaKeys.length > 0) params.media = filter.mediaKeys.join(",");
  if (filter.viewStatuses.length > 0) {
    params.status = filter.viewStatuses.join(",");
  }
  if (filter.category) params.category = filter.category;
  return params;
}

function splitList(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** 쿼리스트링 → 필터. 알 수 없는 값은 조용히 버린다(링크 공유로 들어오는 값이라). */
export function parseSubmissionFilterParams(
  raw: Record<string, unknown>,
): SubmissionFilter {
  return SubmissionFilterSchema.parse({
    campaignId:
      typeof raw.campaignId === "string" && raw.campaignId
        ? raw.campaignId
        : null,
    mediaKeys: splitList(raw.media).filter(
      (value): value is ApplicantMediaFilterKey =>
        ApplicantMediaFilterKeySchema.safeParse(value).success,
    ),
    viewStatuses: splitList(raw.status).filter(
      (value): value is DraftViewStatus =>
        DraftViewStatusSchema.safeParse(value).success,
    ),
    category: CampaignCategorySchema.safeParse(raw.category).success
      ? (raw.category as CampaignCategory)
      : null,
  });
}
