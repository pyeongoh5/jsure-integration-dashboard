/**
 * 어드민 전용 관리 태그를 목록 응답에 싣는 한 가지 방법.
 * 응모자·원고·인플루언서 목록이 같은 include 와 같은 평탄화를 쓴다.
 */
export const INFLUENCER_TAG_INCLUDE = {
  select: { tag: { select: { label: true } } },
  orderBy: { tag: { label: "asc" as const } },
} as const;

export function toTagLabels(
  assignments: { tag: { label: string } }[],
): string[] {
  return assignments.map((assignment) => assignment.tag.label);
}
