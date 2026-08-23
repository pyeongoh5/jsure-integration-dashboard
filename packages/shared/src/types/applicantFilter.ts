import { z } from "zod";
import { ApplicationStatusSchema, type ApplicationStatus } from "./application.js";
import { CampaignCategorySchema, type CampaignCategory } from "./campaign.js";
import { CampaignSubTypeSchema, type CampaignSubType } from "./influencer.js";

/**
 * 응모자 관리 화면에 노출되는 상태. raw ApplicationStatus 를 캠페인 카테고리·수령 여부와
 * 조합해 파생시킨 값이며, 어느 규칙에도 맞지 않는 응모(검토 제출·정산 완료·취소)는 숨긴다.
 */
export const ApplicantViewStatusSchema = z.enum([
  "APPLIED",
  "PRE_SHIP",
  "SHIPPING",
  "DELIVERED",
  "POST_DUE",
  "AWAITING_ORDER",
  "AWAITING_REVIEW",
  "REJECTED",
]);
export type ApplicantViewStatus = z.infer<typeof ApplicantViewStatusSchema>;

export type ApplicantViewStatusRule = {
  viewStatus: ApplicantViewStatus;
  /** 캠페인 카테고리 조건. */
  category: "FAKE_PURCHASE" | "NOT_FAKE_PURCHASE" | "ANY";
  /** 이 규칙에 해당하는 raw 응모 상태. */
  statuses: ApplicationStatus[];
  /** 상품 수령(receivedAt) 조건. */
  received: "RECEIVED" | "NOT_RECEIVED" | "ANY";
};

/**
 * 화면 상태 판정 규칙 — 서로 배타적이라 최대 하나만 매칭된다.
 * 서버의 목록 필터(SQL)와 클라이언트의 상태 표시가 이 표 하나를 공유하므로,
 * 여기에 손대면 양쪽이 함께 바뀐다.
 */
export const APPLICANT_VIEW_STATUS_RULES: readonly ApplicantViewStatusRule[] = [
  {
    viewStatus: "APPLIED",
    category: "ANY",
    statuses: ["APPLIED"],
    received: "ANY",
  },
  {
    viewStatus: "REJECTED",
    category: "ANY",
    statuses: ["REJECTED"],
    received: "ANY",
  },
  // 가구매는 배송이 없어 승인 후 주문 제출 → 리뷰 대기로 흐른다.
  {
    viewStatus: "AWAITING_ORDER",
    category: "FAKE_PURCHASE",
    statuses: ["APPROVED"],
    received: "ANY",
  },
  {
    viewStatus: "AWAITING_REVIEW",
    category: "FAKE_PURCHASE",
    statuses: ["ORDER_SUBMITTED"],
    received: "ANY",
  },
  // 수령 확인이 되면 배송 단계와 무관하게 게시 대기로 본다.
  {
    viewStatus: "POST_DUE",
    category: "NOT_FAKE_PURCHASE",
    statuses: ["APPROVED", "SHIPPED", "DELIVERED", "ORDER_SUBMITTED"],
    received: "RECEIVED",
  },
  {
    viewStatus: "DELIVERED",
    category: "NOT_FAKE_PURCHASE",
    statuses: ["DELIVERED"],
    received: "NOT_RECEIVED",
  },
  {
    viewStatus: "SHIPPING",
    category: "NOT_FAKE_PURCHASE",
    statuses: ["SHIPPED"],
    received: "NOT_RECEIVED",
  },
  {
    viewStatus: "PRE_SHIP",
    category: "NOT_FAKE_PURCHASE",
    statuses: ["APPROVED"],
    received: "NOT_RECEIVED",
  },
];

function matchesRule(
  rule: ApplicantViewStatusRule,
  input: {
    status: ApplicationStatus;
    category: CampaignCategory;
    receivedAt: string | Date | null;
  },
): boolean {
  if (!rule.statuses.includes(input.status)) return false;
  if (rule.category === "FAKE_PURCHASE" && input.category !== "FAKE_PURCHASE") {
    return false;
  }
  if (
    rule.category === "NOT_FAKE_PURCHASE" &&
    input.category === "FAKE_PURCHASE"
  ) {
    return false;
  }
  if (rule.received === "RECEIVED" && input.receivedAt === null) return false;
  if (rule.received === "NOT_RECEIVED" && input.receivedAt !== null) {
    return false;
  }
  return true;
}

/** 화면 노출 상태. null 이면 응모자 관리에서 숨기는 응모. */
export function deriveApplicantViewStatus(input: {
  status: ApplicationStatus;
  category: CampaignCategory;
  receivedAt: string | Date | null;
}): ApplicantViewStatus | null {
  return (
    APPLICANT_VIEW_STATUS_RULES.find((rule) => matchesRule(rule, input))
      ?.viewStatus ?? null
  );
}

/** 서브타입 필터 키 — 인스타그램만 응모 옵션(피드/릴스)으로 세분화한다. */
export const APPLICANT_MEDIA_FILTER_KEYS = [
  "ig-feed",
  "ig-reels",
  "yt",
  "tt",
  "x",
  "qoo10",
  "lips",
  "atcosme",
] as const;
export const ApplicantMediaFilterKeySchema = z.enum(
  APPLICANT_MEDIA_FILTER_KEYS,
);
export type ApplicantMediaFilterKey = z.infer<
  typeof ApplicantMediaFilterKeySchema
>;

/** 필터 키가 가리키는 서브타입. option 이 있으면 응모가 그 옵션을 선택했는지로 판정한다. */
export const APPLICANT_MEDIA_FILTER_TARGET: Record<
  ApplicantMediaFilterKey,
  { subType: CampaignSubType; option: string | null }
> = {
  "ig-feed": { subType: "INSTAGRAM", option: "FEED" },
  "ig-reels": { subType: "INSTAGRAM", option: "REELS" },
  yt: { subType: "YOUTUBE", option: null },
  tt: { subType: "TIKTOK", option: null },
  x: { subType: "X", option: null },
  qoo10: { subType: "QOO10", option: null },
  lips: { subType: "LIPS", option: null },
  atcosme: { subType: "ATCOSME", option: null },
};

/** 응모자 관리 목록·CSV 내보내기가 함께 쓰는 필터 조건. */
export const ApplicantFilterSchema = z.object({
  campaignId: z.string().nullable().default(null),
  mediaKeys: z.array(ApplicantMediaFilterKeySchema).default([]),
  viewStatuses: z.array(ApplicantViewStatusSchema).default([]),
  category: CampaignCategorySchema.nullable().default(null),
  minFollowers: z.number().int().nonnegative().nullable().default(null),
  /** 이름·인플루언서 id·SNS 핸들 부분일치 검색어. */
  query: z.string().default(""),
});
export type ApplicantFilter = z.infer<typeof ApplicantFilterSchema>;

export const EMPTY_APPLICANT_FILTER: ApplicantFilter =
  ApplicantFilterSchema.parse({});

/** 필터를 쿼리스트링 파라미터로 직렬화. 파싱은 parseApplicantFilterParams. */
export function applicantFilterToParams(
  filter: ApplicantFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.campaignId) params.campaignId = filter.campaignId;
  if (filter.mediaKeys.length > 0) params.media = filter.mediaKeys.join(",");
  if (filter.viewStatuses.length > 0) {
    params.status = filter.viewStatuses.join(",");
  }
  if (filter.category) params.category = filter.category;
  if (filter.minFollowers !== null) {
    params.minFollowers = String(filter.minFollowers);
  }
  if (filter.query.trim()) params.q = filter.query.trim();
  return params;
}

function splitList(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/** 쿼리스트링에서 필터 복원. 알 수 없는 값은 조용히 버린다(필터를 좁히지 않는 쪽이 안전). */
export function parseApplicantFilterParams(
  raw: Record<string, unknown>,
): ApplicantFilter {
  const minFollowers = Number(raw.minFollowers);
  return ApplicantFilterSchema.parse({
    campaignId: typeof raw.campaignId === "string" && raw.campaignId ? raw.campaignId : null,
    mediaKeys: splitList(raw.media).filter(
      (value): value is ApplicantMediaFilterKey =>
        ApplicantMediaFilterKeySchema.safeParse(value).success,
    ),
    viewStatuses: splitList(raw.status).filter(
      (value): value is ApplicantViewStatus =>
        ApplicantViewStatusSchema.safeParse(value).success,
    ),
    category: CampaignCategorySchema.safeParse(raw.category).success
      ? (raw.category as CampaignCategory)
      : null,
    minFollowers:
      Number.isFinite(minFollowers) && minFollowers >= 0
        ? Math.floor(minFollowers)
        : null,
    query: typeof raw.q === "string" ? raw.q : "",
  });
}
