/** URL `manager` 파라미터를 쉼표 분리 목록으로 가른다. "me" 는 치환 없이 그대로 보존한다. */
export function parseManagerFilter(param: string | null): string[] {
  if (param === null) return [];
  return param.split(",").filter((piece) => piece.length > 0);
}

/**
 * 캠페인의 담당자 id 목록이 필터와 교집합이 있는지 본다 — 필터는 OR.
 * 필터가 비면 전부 통과. "me" 는 currentAdminUserId 로 풀고, 로그인 정보가 없으면
 * 아무것도 매치하지 않는다(예외를 던지지 않는다).
 */
export function matchesManagerFilter(
  managerIds: string[],
  filter: string[],
  currentAdminUserId: string | null,
): boolean {
  if (filter.length === 0) return true;
  const resolvedFilterIds = filter
    .map((filterItem) => (filterItem === "me" ? currentAdminUserId : filterItem))
    .filter((resolvedId): resolvedId is string => resolvedId !== null);
  return managerIds.some((managerId) => resolvedFilterIds.includes(managerId));
}
