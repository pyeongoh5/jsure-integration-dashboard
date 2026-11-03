/**
 * 공개 범위(비공개/타깃 전용 캠페인) 판정 — 인플루언서 노출 경로가 **모두** 이 조각을 쓴다.
 * 목록·상세·응모 중 한 곳만 빠뜨리면 그 경로로 비대상자가 새므로, 조건을 각자 적지 않는다.
 *
 * RESTRICTED 캠페인은 대상자 행이 없으면 조회 자체에서 탈락해 404 가 된다 —
 * 상세를 보여주고 응모만 막으면 제품·보수·가이드라인이 그대로 노출되기 때문이다.
 */
export function audienceVisibleWhere(influencerId: string) {
  return {
    OR: [
      { audienceMode: "PUBLIC" as const },
      { audience: { some: { influencerId } } },
    ],
  };
}
