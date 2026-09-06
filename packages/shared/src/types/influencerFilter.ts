import { z } from "zod";
import { SnsAccountSubTypeSchema } from "./influencer.js";
import type { SnsAccountSubType } from "./influencer.js";

/** 인플루언서 관리 목록·CSV 내보내기·일괄 발송 후보가 함께 쓰는 필터 조건. */
export const InfluencerFilterSchema = z.object({
  /** 선택한 채널 중 하나라도 계정을 보유하면 포함(OR 매칭). 빈 배열이면 전체. */
  snsTypes: z.array(SnsAccountSubTypeSchema).default([]),
  /** 이름·이메일·SNS 핸들 부분일치 검색어. */
  query: z.string().default(""),
});
export type InfluencerFilter = z.infer<typeof InfluencerFilterSchema>;

export const EMPTY_INFLUENCER_FILTER: InfluencerFilter =
  InfluencerFilterSchema.parse({});

/** 필터를 쿼리스트링 파라미터로 직렬화. 파싱은 parseInfluencerFilterParams. */
export function influencerFilterToParams(
  filter: InfluencerFilter,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filter.snsTypes.length > 0) params.sns = filter.snsTypes.join(",");
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
export function parseInfluencerFilterParams(
  raw: Record<string, unknown>,
): InfluencerFilter {
  return InfluencerFilterSchema.parse({
    snsTypes: splitList(raw.sns).filter(
      (value): value is SnsAccountSubType =>
        SnsAccountSubTypeSchema.safeParse(value).success,
    ),
    query: typeof raw.q === "string" ? raw.q : "",
  });
}
