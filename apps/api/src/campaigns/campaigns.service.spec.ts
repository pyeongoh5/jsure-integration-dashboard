import { jstDayStartUtc, jstDayEndUtc, utcToJstDateStr } from "./campaigns.service";

describe("JST date conversion helpers", () => {
  it("jstDayStartUtc converts YYYY-MM-DD to JST 00:00:00 in UTC", () => {
    // 2026-05-19 00:00:00 JST === 2026-05-18 15:00:00 UTC
    expect(jstDayStartUtc("2026-05-19").toISOString()).toBe(
      "2026-05-18T15:00:00.000Z",
    );
  });

  it("jstDayEndUtc converts YYYY-MM-DD to JST 23:59:59 in UTC", () => {
    // 2026-05-19 23:59:59 JST === 2026-05-19 14:59:59 UTC
    expect(jstDayEndUtc("2026-05-19").toISOString()).toBe(
      "2026-05-19T14:59:59.000Z",
    );
  });

  it("utcToJstDateStr returns the JST calendar date for a UTC Date", () => {
    expect(utcToJstDateStr(new Date("2026-05-18T15:00:00Z"))).toBe(
      "2026-05-19",
    );
    expect(utcToJstDateStr(new Date("2026-05-19T14:59:59Z"))).toBe(
      "2026-05-19",
    );
  });
});
