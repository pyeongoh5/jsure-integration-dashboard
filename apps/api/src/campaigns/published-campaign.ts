/**
 * 임시저장(DRAFT)·삭제된 캠페인을 제외하는 공용 where 조각.
 * 인플루언서 노출 경로와 어드민 집계는 항상 이걸 걸어야 한다.
 * 어드민 캠페인 관리 목록/상세만 DRAFT 를 포함해 조회한다.
 */
export const PUBLISHED_CAMPAIGN_WHERE = {
  publishState: "PUBLISHED",
  deletedAt: null,
} as const;

/**
 * 인플루언서에게 노출 가능한 캠페인. 비공개(hiddenAt) 까지 제외한다.
 * 어드민은 비공개 캠페인도 계속 봐야 하므로 PUBLISHED_CAMPAIGN_WHERE 를 쓴다.
 */
export const VISIBLE_PUBLISHED_CAMPAIGN_WHERE = {
  ...PUBLISHED_CAMPAIGN_WHERE,
  hiddenAt: null,
} as const;
