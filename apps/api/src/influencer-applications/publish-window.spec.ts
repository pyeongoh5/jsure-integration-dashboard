import { publishWindowState, resolvePostingDeadline } from "@jsure/shared";

const START = "2026-09-01T01:00:00.000Z"; // JST 2026-09-01 10:00
const END = "2026-09-10T14:59:59.000Z"; // JST 2026-09-10 23:59

describe("publishWindowState", () => {
  it("게시 기간이 없으면 NONE", () => {
    expect(
      publishWindowState({
        publishStartAt: null,
        publishEndAt: null,
        now: new Date("2026-08-28T00:00:00Z"),
      }),
    ).toBe("NONE");
  });

  it("시작 이전이면 BEFORE", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-08-28T00:00:00Z"),
      }),
    ).toBe("BEFORE");
  });

  it("시작 시각과 동일하면 OPEN — 경계는 열려 있다", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date(START),
      }),
    ).toBe("OPEN");
  });

  it("기간 중이면 OPEN", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-09-05T00:00:00Z"),
      }),
    ).toBe("OPEN");
  });

  it("종료 이후면 AFTER", () => {
    expect(
      publishWindowState({
        publishStartAt: START,
        publishEndAt: END,
        now: new Date("2026-09-11T00:00:00Z"),
      }),
    ).toBe("AFTER");
  });
});

describe("resolvePostingDeadline", () => {
  it("게시 종료가 있으면 그것이 마감", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: END,
        anchorAt: "2026-08-20T00:00:00Z",
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe(new Date(END).toISOString());
  });

  it("게시 종료가 없으면 기준일 + postingPeriodDays", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: null,
        anchorAt: "2026-08-20T00:00:00Z",
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe("2026-09-03T00:00:00.000Z");
  });

  it("게시 종료도 기준일도 없으면 null", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: null,
        anchorAt: null,
        postingPeriodDays: 14,
      }),
    ).toBeNull();
  });

  it("기준일이 없어도 게시 종료가 있으면 마감이 나온다", () => {
    expect(
      resolvePostingDeadline({
        publishEndAt: END,
        anchorAt: null,
        postingPeriodDays: 14,
      })?.toISOString(),
    ).toBe(new Date(END).toISOString());
  });
});
