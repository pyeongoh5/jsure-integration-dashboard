/**
 * 소재 커버리지 — 계산은 `@jsure/jwin-shared` 의 것을 쓴다(서버와 같은 함수).
 * 이 파일에는 화면 표시용 포맷만 남긴다.
 */
export {
  postTemplateCoverage,
  type CoverageGap,
  type PostTemplateCoverage,
} from "@jsure/jwin-shared";
import type { CoverageGap } from "@jsure/jwin-shared";

/** "2026-09-08" → "9/8" */
function shortDate(dateJst: string): string {
  const [, month = "", day = ""] = dateJst.split("-");
  return `${Number(month)}/${Number(day)}`;
}

/** 날짜 나열만 만든다(언어 중립). 예: "9/1 ~ 9/2, 9/10" */
export function formatCoverageGaps(gaps: CoverageGap[]): string {
  return gaps
    .map((gap) => {
      if (gap.fromDateJst === gap.toDateJst) return shortDate(gap.fromDateJst);
      return `${shortDate(gap.fromDateJst)} ~ ${shortDate(gap.toDateJst)}`;
    })
    .join(", ");
}
