import { z } from "zod";

/**
 * 대상자가 등록된 경로. 어드민 목록에서 출처 뱃지를 그리는 용도이며 노출 판정에는
 * 쓰지 않는다 — 판정은 "대상자 행이 있는가" 하나로 끝난다.
 * - CAMPAIGN: 기존 캠페인 승인자 불러오기
 * - TAG: 관리 태그 매칭
 * - MANUAL: 어드민이 검색해서 직접 지정
 */
export const CampaignAudienceSourceSchema = z.enum([
  "CAMPAIGN",
  "TAG",
  "MANUAL",
]);
export type CampaignAudienceSource = z.infer<
  typeof CampaignAudienceSourceSchema
>;

/** 어드민 대상자 목록 한 행. 누가 왜 대상인지 확인하고 지우기 위한 최소 정보만 담는다. */
export const CampaignAudienceEntrySchema = z.object({
  influencerId: z.string(),
  name: z.string(),
  email: z.string(),
  source: CampaignAudienceSourceSchema,
  /**
   * 출처의 사람이 읽을 수 있는 이름 — CAMPAIGN 이면 캠페인 제목, TAG 면 태그 라벨,
   * MANUAL 이면 null. 원본이 삭제됐으면 null 이 될 수 있다.
   */
  sourceLabel: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type CampaignAudienceEntry = z.infer<typeof CampaignAudienceEntrySchema>;

export const CampaignAudienceListResponseSchema = z.object({
  audience: z.array(CampaignAudienceEntrySchema),
});
export type CampaignAudienceListResponse = z.infer<
  typeof CampaignAudienceListResponseSchema
>;
