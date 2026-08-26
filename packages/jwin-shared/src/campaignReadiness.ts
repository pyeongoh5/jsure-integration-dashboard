/**
 * 캠페인 발행 준비 판정 — 화면과 서버가 **같은 함수**로 판정한다.
 *
 * 각자 구현하면 한쪽만 고쳤을 때 조용히 어긋난다. 특히 소재 커버리지는
 * 어긋나면 "화면은 괜찮다는데 그날 게시가 안 나가는" 사고가 되고,
 * 에러도 로그도 남지 않아 브랜드가 항의할 때까지 아무도 모른다.
 *
 * 여기 있는 것은 전부 순수 함수다. i18n·React·Prisma 를 import 하지 않는다.
 */

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

/** 엑셀 붙여넣기 대응: 개행/탭/쉼표로 분리, 공백 제거 (F-7.3) */
export function parseCodesInput(raw: string): string[] {
  return raw
    .split(/[\r\n\t,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

/**
 * 코드 자리가 빠졌는지 판정.
 * 빈 문구는 서버 기본 문구(= {{CODE}} 포함)가 쓰이므로 누락이 아니다.
 */
export function dmTemplateMissingCode(template: string | null): boolean {
  if (template === null || template.trim().length === 0) return false;
  return !template.includes("{{CODE}}");
}
