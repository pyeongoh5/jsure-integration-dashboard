import { influencerActivityEntries } from "./influencer-activity";

const APPLIED_AT = new Date("2026-08-01T00:00:00.000Z");

function makeSource(
  overrides: Partial<Parameters<typeof influencerActivityEntries>[0]> = {},
) {
  return {
    appliedAt: APPLIED_AT,
    orderSubmittedAt: null,
    receivedAt: null,
    posts: [],
    ...overrides,
  };
}

describe("influencerActivityEntries", () => {
  it("응모는 항상 1건 나오고 origin 은 INFLUENCER, actor 는 null", () => {
    const entries = influencerActivityEntries(makeSource());

    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      id: "synthetic-apply",
      action: "APPLICATION_APPLY",
      origin: "INFLUENCER",
      actor: null,
      metadata: null,
      createdAt: "2026-08-01T00:00:00.000Z",
    });
  });

  it("null 인 타임스탬프는 항목을 만들지 않는다", () => {
    const entries = influencerActivityEntries(
      makeSource({ receivedAt: new Date("2026-08-04T09:30:00.000Z") }),
    );

    expect(entries.map((entry) => entry.action)).toEqual([
      "APPLICATION_APPLY",
      "APPLICATION_RECEIVE_CONFIRM",
    ]);
  });

  it("주문번호 제출도 1건 나온다", () => {
    const entries = influencerActivityEntries(
      makeSource({
        orderSubmittedAt: new Date("2026-08-02T01:00:00.000Z"),
      }),
    );

    expect(entries.map((entry) => entry.action)).toEqual([
      "APPLICATION_APPLY",
      "APPLICATION_ORDER_SUBMIT",
    ]);
  });

  it("같은 시각에 제출된 게시물은 1건으로 묶고 서브타입을 metadata 에 모은다", () => {
    const submittedAt = new Date("2026-08-05T02:00:00.000Z");
    const entries = influencerActivityEntries(
      makeSource({
        posts: [
          { subType: "INSTAGRAM", submittedAt, insightSubmittedAt: null },
          { subType: "X", submittedAt, insightSubmittedAt: null },
        ],
      }),
    );

    const submitEntries = entries.filter(
      (entry) => entry.action === "POST_SUBMIT",
    );
    expect(submitEntries).toHaveLength(1);
    expect(submitEntries[0]!.metadata).toEqual({ subTypes: ["INSTAGRAM", "X"] });
  });

  it("제출 시각이 다르면 게시물별로 나눈다", () => {
    const entries = influencerActivityEntries(
      makeSource({
        posts: [
          {
            subType: "INSTAGRAM",
            submittedAt: new Date("2026-08-05T02:00:00.000Z"),
            insightSubmittedAt: null,
          },
          {
            subType: "X",
            submittedAt: new Date("2026-08-06T02:00:00.000Z"),
            insightSubmittedAt: null,
          },
        ],
      }),
    );

    const submitEntries = entries.filter(
      (entry) => entry.action === "POST_SUBMIT",
    );
    expect(submitEntries).toHaveLength(2);
    expect(submitEntries.map((entry) => entry.createdAt)).toEqual([
      "2026-08-05T02:00:00.000Z",
      "2026-08-06T02:00:00.000Z",
    ]);
  });

  it("인사이트 제출도 같은 시각끼리 묶는다", () => {
    const insightSubmittedAt = new Date("2026-08-09T02:00:00.000Z");
    const entries = influencerActivityEntries(
      makeSource({
        posts: [
          {
            subType: "INSTAGRAM",
            submittedAt: new Date("2026-08-05T02:00:00.000Z"),
            insightSubmittedAt,
          },
          {
            subType: "X",
            submittedAt: new Date("2026-08-05T02:00:00.000Z"),
            insightSubmittedAt,
          },
        ],
      }),
    );

    const insightEntries = entries.filter(
      (entry) => entry.action === "INSIGHT_SUBMIT",
    );
    expect(insightEntries).toHaveLength(1);
    expect(insightEntries[0]!.metadata).toEqual({
      subTypes: ["INSTAGRAM", "X"],
    });
  });

  it("합성 id 는 항목마다 고유하다 (React key 충돌 방지)", () => {
    const entries = influencerActivityEntries(
      makeSource({
        orderSubmittedAt: new Date("2026-08-02T01:00:00.000Z"),
        receivedAt: new Date("2026-08-04T09:30:00.000Z"),
        posts: [
          {
            subType: "INSTAGRAM",
            submittedAt: new Date("2026-08-05T02:00:00.000Z"),
            insightSubmittedAt: new Date("2026-08-09T02:00:00.000Z"),
          },
          {
            subType: "X",
            submittedAt: new Date("2026-08-06T02:00:00.000Z"),
            insightSubmittedAt: null,
          },
        ],
      }),
    );

    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
