export type MultiSelectLabel = { text: string; title: string };

/**
 * 다중 선택 라벨을 만든다. `maxVisibleLabels` 를 넘기면 앞 N개만 보이고
 * 나머지는 "+M" 으로 접는다. M 은 언어 중립 기호라 번역하지 않는다 — 전원
 * 목록은 title 에 그대로 담겨 호버로 확인한다.
 */
export function buildMultiSelectLabel(
  labels: string[],
  maxVisibleLabels?: number,
): MultiSelectLabel {
  const title = labels.join(", ");
  if (maxVisibleLabels === undefined || labels.length <= maxVisibleLabels) {
    return { text: title, title };
  }
  const visibleLabels = labels.slice(0, maxVisibleLabels);
  const hiddenCount = labels.length - maxVisibleLabels;
  return { text: `${visibleLabels.join(", ")} +${hiddenCount}`, title };
}
