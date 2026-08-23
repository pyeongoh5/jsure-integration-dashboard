/**
 * 소재 커버리지 — 캠페인 기간 중 "게시가 통째로 건너뛰어지는 날"을 찾는다.
 *
 * 스케줄러(apps/jwin-api/src/services/scheduler.ts materializeTodayPosts)는
 * 매일 JST 00:05 에 한 번 돌면서 `activeFrom <= now && now <= activeTo` 인 소재를 고른다.
 * 즉 어떤 날 D 에 게시가 나가려면 **D 의 00:05 JST 시점**에 유효한 소재가 있어야 한다.
 * activeFrom 이 D 낮이면 그날은 건너뛴다 — 에러도 안 나고 아무 데도 안 보인다.
 * 그래서 달력 날짜가 아니라 이 판정 시각으로 커버 여부를 본다.
 *
 * 입력 날짜는 전부 UTC ISO 문자열(서버 응답 그대로).
 * 반환값은 언어 중립 데이터다 — 경고 문장은 호출부가 i18n 키로 만든다.
 */

/** 스케줄러가 그날 소재를 고르는 시각 */
const MATERIALIZE_AT_JST = "T00:05:00+09:00";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CoverageGap = {
  /** "YYYY-MM-DD" (JST) */
  fromDateJst: string;
  toDateJst: string;
};

export type PostTemplateCoverage = {
  /** 실제로 게시가 예정되는 JST 날짜들 */
  postingDates: string[];
  /** 소재가 없어 건너뛰는 날들의 연속 구간 */
  gaps: CoverageGap[];
};

/** UTC ISO → JST 달력 날짜 "YYYY-MM-DD" */
function toDateJst(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" (JST) → 그날 스케줄러가 도는 시각의 epoch ms */
function materializeMoment(dateJst: string): number {
  return new Date(`${dateJst}${MATERIALIZE_AT_JST}`).getTime();
}

/** "YYYY-MM-DD" → 다음 날 "YYYY-MM-DD" */
function nextDateJst(dateJst: string): string {
  return new Date(new Date(`${dateJst}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

export function postTemplateCoverage(
  campaign: { startsAt: string; endsAt: string },
  templates: { activeFrom: string; activeTo: string }[],
): PostTemplateCoverage {
  const startsAt = new Date(campaign.startsAt).getTime();
  const endsAt = new Date(campaign.endsAt).getTime();
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt) || endsAt < startsAt) {
    return { postingDates: [], gaps: [] };
  }

  const ranges = templates.map((template) => ({
    from: new Date(template.activeFrom).getTime(),
    to: new Date(template.activeTo).getTime(),
  }));

  const postingDates: string[] = [];
  const gaps: CoverageGap[] = [];
  // 열린 빈틈 구간. gaps 에 넣어둔 객체와 같은 참조라 toDateJst 만 늘려가면 된다.
  let openGap: CoverageGap | null = null;

  const lastDate = toDateJst(campaign.endsAt);
  for (let date = toDateJst(campaign.startsAt); date <= lastDate; date = nextDateJst(date)) {
    const moment = materializeMoment(date);

    // 스케줄러가 도는 시각에 캠페인이 아직 시작 전이거나 이미 끝났다 → 게시 대상이 아니다
    if (moment < startsAt || moment > endsAt) {
      openGap = null;
      continue;
    }
    postingDates.push(date);

    const covered = ranges.some((range) => range.from <= moment && moment <= range.to);
    if (covered) {
      openGap = null;
      continue;
    }
    if (openGap) {
      openGap.toDateJst = date;
      continue;
    }
    openGap = { fromDateJst: date, toDateJst: date };
    gaps.push(openGap);
  }

  return { postingDates, gaps };
}

/** "2026-09-08" → "9/8" */
function shortDate(dateJst: string): string {
  const [, month, day] = dateJst.split("-");
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
