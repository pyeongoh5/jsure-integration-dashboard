import { describe, expect, it } from "vitest";
import { postTemplateCoverage, parseCodesInput, dmTemplateMissingCode } from "./campaignReadiness";

/** 2026-09-01 00:00 JST ~ 2026-09-05 23:59 JST (5일) */
const CAMPAIGN = {
  startsAt: "2026-08-31T15:00:00.000Z",
  endsAt: "2026-09-05T14:59:00.000Z",
};

/** JST 날짜·시각 → UTC ISO */
function jst(dateTime: string): string {
  return new Date(`${dateTime}+09:00`).toISOString();
}

describe("postTemplateCoverage", () => {
  it("소재가 하나도 없으면 기간 전체가 빈틈", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, []);
    expect(coverage.postingDates).toEqual([
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-05" }]);
  });

  it("소재 1개가 전 기간을 덮으면 빈틈이 없다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("중간이 비면 그 구간만 빈틈으로 잡는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-02T23:59:00") },
      { activeFrom: jst("2026-09-05T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-03", toDateJst: "2026-09-04" }]);
  });

  it("앞뒤가 모두 비면 빈틈 구간이 두 개", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-03T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([
      { fromDateJst: "2026-09-01", toDateJst: "2026-09-02" },
      { fromDateJst: "2026-09-04", toDateJst: "2026-09-05" },
    ]);
  });

  it("소재 기간이 겹쳐도 빈틈으로 세지 않는다", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-01T00:00:00"), activeTo: jst("2026-09-04T23:59:00") },
      { activeFrom: jst("2026-09-03T00:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([]);
  });

  it("소재가 그날 낮부터 시작하면 그날은 빈틈이다 (스케줄러가 00:05 JST에 판정)", () => {
    const coverage = postTemplateCoverage(CAMPAIGN, [
      { activeFrom: jst("2026-09-03T12:00:00"), activeTo: jst("2026-09-05T23:59:00") },
    ]);
    expect(coverage.gaps).toEqual([{ fromDateJst: "2026-09-01", toDateJst: "2026-09-03" }]);
  });

  it("00:05 JST 시점이 하나도 없는 짧은 캠페인은 게시 예정일이 없다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-01T10:00:00"), endsAt: jst("2026-09-01T20:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });

  it("종료가 시작보다 앞서면 빈 결과를 돌려준다", () => {
    const coverage = postTemplateCoverage(
      { startsAt: jst("2026-09-05T00:00:00"), endsAt: jst("2026-09-01T00:00:00") },
      [],
    );
    expect(coverage.postingDates).toEqual([]);
    expect(coverage.gaps).toEqual([]);
  });
});

describe('parseCodesInput', () => {
  it('개행·탭·쉼표로 구분하고 공백을 제거한다', () => {
    expect(parseCodesInput('AAA\r\nBBB\tCCC, DDD ')).toEqual(['AAA', 'BBB', 'CCC', 'DDD']);
  });

  it('빈 줄은 세지 않는다', () => {
    expect(parseCodesInput('AAA\n\n\nBBB\n')).toEqual(['AAA', 'BBB']);
  });

  it('빈 입력은 빈 배열', () => {
    expect(parseCodesInput('   \n  ')).toEqual([]);
  });
});

describe('dmTemplateMissingCode', () => {
  it('빈 문구는 서버 기본 문구가 쓰이므로 누락이 아니다', () => {
    expect(dmTemplateMissingCode(null)).toBe(false);
    expect(dmTemplateMissingCode('   ')).toBe(false);
  });

  it('코드 자리가 있으면 누락이 아니다', () => {
    expect(dmTemplateMissingCode('ギフトコード: {{CODE}}')).toBe(false);
  });

  it('직접 쓴 문구에 코드 자리가 없으면 누락이다', () => {
    expect(dmTemplateMissingCode('おめでとうございます！')).toBe(true);
  });
});
