import { describe, expect, it } from "vitest";
import { utcIsoToJstDate, jstDateStartUtcIso, jstDateEndUtcIso } from "./jwinDateTime";

describe("캠페인 날짜(일 단위) 변환", () => {
  it("utcIsoToJstDate — UTC ISO 를 JST 달력 날짜로", () => {
    // 2026-10-23 15:00 UTC === 2026-10-24 00:00 JST
    expect(utcIsoToJstDate("2026-10-23T15:00:00.000Z")).toBe("2026-10-24");
    // 2026-10-24 14:59 UTC === 2026-10-24 23:59 JST
    expect(utcIsoToJstDate("2026-10-24T14:59:59.000Z")).toBe("2026-10-24");
  });

  it("jstDateStartUtcIso — 시작일 JST 0시의 UTC ISO", () => {
    expect(jstDateStartUtcIso("2026-10-24")).toBe("2026-10-23T15:00:00.000Z");
  });

  it("jstDateEndUtcIso — 종료일 JST 23:59:59 의 UTC ISO", () => {
    expect(jstDateEndUtcIso("2026-10-24")).toBe("2026-10-24T14:59:59.000Z");
  });
});
