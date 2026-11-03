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

/** 이 캠페인들에서 승인(선정)된 적 있는 인플루언서를 대상자로 불러온다. */
const AudienceCampaignIdsField = z.array(z.string()).max(50);
/**
 * 이 관리 태그가 달린 인플루언서를 대상자로 불러온다. id 가 아니라 라벨인 이유는
 * 어드민 폼이 캠페인 태그와 같은 칩 입력(TagsInput)을 쓰기 때문. 등록되지 않은
 * 라벨은 저장 시 거절된다 — 여기서 태그를 새로 만들지는 않는다.
 */
const AudienceTagLabelsField = z
  .array(z.string().trim().min(1).max(INFLUENCER_TAG_LABEL_MAX_LENGTH))
  .max(10);
/** 어드민이 검색해서 직접 지정한 인플루언서 id. */
const AudienceInfluencerIdsField = z
  .array(z.string())
  .max(AUDIENCE_MANUAL_MAX_COUNT);

/**
 * 비공개 캠페인의 대상자 지정 입력 — 세 경로를 함께 쓸 수 있고 결과는 합집합이다.
 *
 * 이 값은 "결과 명단"이 아니라 **규칙**이다. 어드민 폼의 피커가 보여주는 선택 상태가
 * 그대로 여기 담기고, 서버가 규칙을 사람으로 풀어 campaign_audiences 에 반영한다.
 * - 규칙을 새로 넣으면 그 규칙으로 걸리는 인원이 추가된다.
 * - 규칙을 빼면 그 규칙으로만 들어온 인원이 빠진다(다른 규칙에도 걸리면 남는다).
 * - 규칙을 그대로 두면 목록에서 개별 제외한 인원이 되살아나지 않는다.
 *
 * 캠페인 생성·발행 요청과 실시간 프리뷰 요청이 같은 모양을 쓴다.
 */
export const AUDIENCE_INPUT_SHAPE = {
  audienceCampaignIds: AudienceCampaignIdsField.default([]),
  audienceTagLabels: AudienceTagLabelsField.default([]),
  audienceInfluencerIds: AudienceInfluencerIdsField.default([]),
} as const;

/**
 * 수정·임시저장 요청용. 전부 미지정이면 "대상자를 건드리지 않음" 이다 —
 * 빈 배열(`[]`)은 "그 규칙을 비운다"는 뜻이라 전체 삭제로 이어지므로,
 * 필드를 보내지 않는 호출자가 실수로 대상자를 전멸시키지 않도록 구분한다.
 */
export const AUDIENCE_PATCH_SHAPE = {
  audienceCampaignIds: AudienceCampaignIdsField.optional(),
  audienceTagLabels: AudienceTagLabelsField.optional(),
  audienceInfluencerIds: AudienceInfluencerIdsField.optional(),
} as const;

export const CampaignAudienceInputSchema = z.object(AUDIENCE_INPUT_SHAPE);
export type CampaignAudienceInput = z.infer<typeof CampaignAudienceInputSchema>;

export const CampaignAudiencePatchSchema = z.object(AUDIENCE_PATCH_SHAPE);
export type CampaignAudiencePatch = z.infer<typeof CampaignAudiencePatchSchema>;

/**
 * 패치 입력 → 반영할 규칙. 세 필드가 모두 미지정이면 null(건드리지 않음)을 돌려준다.
 * 하나라도 지정됐으면 나머지는 빈 규칙으로 간주한다 — 어드민 폼은 항상 셋을 함께 보낸다.
 */
export function audiencePatchToInput(
  patch: CampaignAudiencePatch,
): CampaignAudienceInput | null {
  if (
    patch.audienceCampaignIds === undefined &&
    patch.audienceTagLabels === undefined &&
    patch.audienceInfluencerIds === undefined
  ) {
    return null;
  }
  return {
    audienceCampaignIds: patch.audienceCampaignIds ?? [],
    audienceTagLabels: patch.audienceTagLabels ?? [],
    audienceInfluencerIds: patch.audienceInfluencerIds ?? [],
  };
}

/** 저장된 대상자에서 거꾸로 복원한 규칙 — 수정 화면이 피커를 기선택 상태로 그린다. */
export const CampaignAudienceSelectionResponseSchema = z.object(
  AUDIENCE_INPUT_SHAPE,
);
export type CampaignAudienceSelectionResponse = z.infer<
  typeof CampaignAudienceSelectionResponseSchema
>;

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

/** 대상자 명단 한 행. 누가 왜 대상인지 확인하기 위한 최소 정보만 담는다. */
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
   * 아직 저장되지 않은(이번 저장에서 새로 들어오는) 대상자. 저장하면 사라지는
   * 구분이라 프리뷰에서만 의미가 있다.
   */
  pending: z.boolean().default(false),
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
  /**
   * 선택했지만 아무도 걸리지 않은 규칙의 이름(캠페인 제목·태그 라벨).
   * 승인자가 아직 없는 캠페인을 고르면 조용히 0명이 되므로 명시적으로 알린다.
   */
  emptyRuleLabels: z.array(z.string()).default([]),
});
export type CampaignAudienceListResponse = z.infer<
  typeof CampaignAudienceListResponseSchema
>;

/**
 * 공개 대상과 참여 제외의 충돌 판정 — 서버와 어드민 폼이 **같은 함수**를 쓴다.
 *
 * 같은 캠페인을 "승인자를 대상자로 불러오기"와 "참여 제외 기준"에 동시에 지정하면
 * 한쪽은 그 캠페인 참여자에게 열어주고 다른 쪽은 막는 설정이 된다. 서로 보는
 * 단계가 조금 달라(승인 vs 제출물 승인) 전원이 막히지는 않지만, 의도한 설정일
 * 수 없으므로 저장 전에 잡는다.
 *
 * 문구는 만들지 않고 충돌한 캠페인 id 만 돌려준다 — 서버는 고정 문자열,
 * 화면은 i18n 을 쓰기 때문이다.
 */
export function audienceExclusionConflicts(values: {
  audienceCampaignIds?: string[];
  excludedCampaignIds?: string[];
}): string[] {
  const excluded = new Set(values.excludedCampaignIds ?? []);
  return Array.from(new Set(values.audienceCampaignIds ?? [])).filter((id) =>
    excluded.has(id),
  );
}
