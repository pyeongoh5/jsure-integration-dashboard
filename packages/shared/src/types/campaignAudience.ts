import { z } from "zod";
import { INFLUENCER_TAG_LABEL_MAX_LENGTH } from "./influencerTag.js";

/**
 * 캠페인 공개 범위.
 * - PUBLIC: 모든 인플루언서에게 노출·응모 허용 (기존 동작).
 * - RESTRICTED: 대상자로 등록된 인플루언서에게만 노출·응모 허용. 대상자가 0명이면
 *   아무에게도 보이지 않는다 — 실수로 전체 공개되는 것보다 안전한 쪽을 택했다.
 */
export const CampaignAudienceModeSchema = z.enum(["PUBLIC", "RESTRICTED"]);
export type CampaignAudienceMode = z.infer<typeof CampaignAudienceModeSchema>;

/** 한 번의 저장으로 직접 지정할 수 있는 인원 상한. 검색해서 한 명씩 고르는 UI 라 넉넉히 둔다. */
export const AUDIENCE_MANUAL_MAX_COUNT = 500;

/**
 * 비공개 캠페인의 대상자 "추가" 입력. 세 경로를 함께 쓸 수 있고 서버가 합집합으로 등록한다.
 *
 * 교체가 아니라 추가인 이유: 어드민이 대상자 목록에서 개별 삭제한 사람이 다음 저장
 * 때 되살아나면 안 되기 때문이다. 제거는 대상자 목록 화면에서만 한다.
 *
 * 캠페인 저장 요청(생성/수정/임시저장)과 실시간 프리뷰 요청이 같은 모양을 쓴다.
 */
export const AUDIENCE_INPUT_SHAPE = {
  /** 이 캠페인들에서 승인(선정)된 적 있는 인플루언서를 대상자로 불러온다. */
  audienceCampaignIds: z.array(z.string()).max(50).default([]),
  /**
   * 이 관리 태그가 달린 인플루언서를 대상자로 불러온다. id 가 아니라 라벨인 이유는
   * 어드민 폼이 캠페인 태그와 같은 칩 입력(TagsInput)을 쓰기 때문. 등록되지 않은
   * 라벨은 저장 시 거절된다 — 여기서 태그를 새로 만들지는 않는다.
   */
  audienceTagLabels: z
    .array(z.string().trim().min(1).max(INFLUENCER_TAG_LABEL_MAX_LENGTH))
    .max(10)
    .default([]),
  /** 어드민이 검색해서 직접 지정한 인플루언서 id. */
  audienceInfluencerIds: z
    .array(z.string())
    .max(AUDIENCE_MANUAL_MAX_COUNT)
    .default([]),
} as const;

export const CampaignAudienceInputSchema = z.object(AUDIENCE_INPUT_SHAPE);
export type CampaignAudienceInput = z.infer<typeof CampaignAudienceInputSchema>;

/**
 * 저장 전 실시간 프리뷰 요청. campaignId 가 있으면 이미 등록된 대상자와 합쳐서
 * "저장하면 최종적으로 이렇게 된다"를 보여준다. 신규 작성이면 null.
 */
export const CampaignAudiencePreviewRequestSchema = z.object({
  campaignId: z.string().nullable().default(null),
  ...AUDIENCE_INPUT_SHAPE,
});
export type CampaignAudiencePreviewRequest = z.infer<
  typeof CampaignAudiencePreviewRequestSchema
>;

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
  /**
   * 아직 저장되지 않은(이번 저장에서 추가될) 대상자. 프리뷰에서만 true 가 되며,
   * 저장 전이라 개별 제외 대상이 아니다 — 위 피커에서 선택을 빼면 된다.
   */
  pending: z.boolean().default(false),
  /** 저장된 시각. pending 행은 아직 저장 전이라 null. */
  createdAt: z.string().datetime().nullable(),
});
export type CampaignAudienceEntry = z.infer<typeof CampaignAudienceEntrySchema>;

export const CampaignAudienceListResponseSchema = z.object({
  audience: z.array(CampaignAudienceEntrySchema),
  /**
   * 입력에 있었지만 마스터에 등록되지 않은 태그 라벨. 프리뷰는 조용히 건너뛰고
   * 여기에 담아 알리고, 저장은 거절한다 — 오타 하나로 대상자 0명인 캠페인이
   * 만들어지는 쪽이 더 위험하다.
   */
  unknownTagLabels: z.array(z.string()).default([]),
});
export type CampaignAudienceListResponse = z.infer<
  typeof CampaignAudienceListResponseSchema
>;
