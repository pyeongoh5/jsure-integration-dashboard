import { z } from "zod";

/** 캠페인 관리 태그와 같은 상한을 쓴다 — 어드민이 두 화면에서 같은 감각으로 입력하도록. */
export const INFLUENCER_TAG_LABEL_MAX_LENGTH = 20;
export const INFLUENCER_TAGS_MAX_COUNT = 10;

/** 어드민 전용 인플루언서 관리 태그 마스터 한 건. 자동완성 후보의 단위. */
export const InfluencerTagSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type InfluencerTag = z.infer<typeof InfluencerTagSchema>;

export const InfluencerTagListResponseSchema = z.object({
  tags: z.array(InfluencerTagSchema),
});
export type InfluencerTagListResponse = z.infer<
  typeof InfluencerTagListResponseSchema
>;

/**
 * 한 인플루언서의 태그 전체를 교체한다. id 가 아니라 라벨로 받는 이유는
 * 새 태그를 "생성 → id 조회 → 할당"의 2회 왕복 없이 한 번에 달기 위해서다.
 * 마스터에 없는 라벨은 서버가 생성한다.
 */
export const UpdateInfluencerTagsRequestSchema = z.object({
  labels: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(
          INFLUENCER_TAG_LABEL_MAX_LENGTH,
          `태그는 ${INFLUENCER_TAG_LABEL_MAX_LENGTH}자 이하로 입력해주세요`,
        ),
    )
    .max(
      INFLUENCER_TAGS_MAX_COUNT,
      `태그는 ${INFLUENCER_TAGS_MAX_COUNT}개까지 입력할 수 있습니다`,
    ),
});
export type UpdateInfluencerTagsRequest = z.infer<
  typeof UpdateInfluencerTagsRequestSchema
>;

/** 교체 후 확정된 태그 라벨 — 목록·팝업이 같은 모양(string[])으로 그린다. */
export const UpdateInfluencerTagsResponseSchema = z.object({
  tags: z.array(z.string()),
});
export type UpdateInfluencerTagsResponse = z.infer<
  typeof UpdateInfluencerTagsResponseSchema
>;
