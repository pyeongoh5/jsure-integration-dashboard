/**
 * 셀렉트의 "실효 선택값". 들고 있던 선택이 현재 목록에 없으면 첫 항목으로 떨어뜨린다.
 *
 * `<select>` 는 value 가 어떤 option 과도 안 맞으면 조용히 첫 옵션을 그린다 — 그래서
 * 선택 상태를 목록과 따로 관리하면 "화면엔 A, 조회는 B" 가 눈에 띄지 않게 생긴다.
 * 조회 키를 목록에서 파생시켜 그 불일치를 구조적으로 없앤다.
 */
export function resolveSelectedId<T extends { id: string }>(
  rows: readonly T[],
  selected: string | null,
): string | null {
  if (selected !== null && rows.some((row) => row.id === selected)) return selected;
  return rows[0]?.id ?? null;
}
