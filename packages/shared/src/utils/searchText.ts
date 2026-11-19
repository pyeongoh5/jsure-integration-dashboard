/**
 * 부분일치 검색 비교용 정규화.
 *
 * 캠페인명에 전각 문자가 섞여 들어오는 일이 흔하다(`🍯My Normal：アルロース` 의 `：`).
 * 단순 소문자 비교는 반각 `:` 로 입력하면 못 찾으므로 NFKC 로 전각/반각 차이까지
 * 흡수한다 — 반각 카타카나(`ｱﾙﾛｰｽ`)로 입력해도 `アルロース` 에 걸린다.
 *
 * 검색어와 대상 문자열 양쪽에 같이 적용해야 한다.
 */
export function foldForSearch(text: string): string {
  return text.normalize("NFKC").toLowerCase();
}
