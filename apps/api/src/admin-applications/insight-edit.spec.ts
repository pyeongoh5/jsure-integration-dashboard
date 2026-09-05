import {
  buildInsightChanges,
  buildInsightUpdateData,
  type InsightSnapshot,
} from "./insight-edit";

const BEFORE: InsightSnapshot = {
  url: "https://example.com/post",
  insightLikes: 100,
  insightComments: 10,
  insightShares: 5,
  insightReposts: 3,
  insightSaves: 7,
  insightViews: 1_000_000,
  insightReach: null,
};

describe("buildInsightUpdateData", () => {
  it("바뀐 값만 담는다", () => {
    expect(buildInsightUpdateData(BEFORE, { views: 10_000, likes: 100 })).toEqual({
      insightViews: 10_000,
    });
  });

  it("생략한 필드는 건드리지 않는다", () => {
    expect(buildInsightUpdateData(BEFORE, {})).toEqual({});
  });

  it("null 은 값 삭제로 취급한다", () => {
    expect(buildInsightUpdateData(BEFORE, { saves: null, reach: null })).toEqual({
      insightSaves: null,
    });
  });

  it("URL 도 달라질 때만 담는다", () => {
    expect(buildInsightUpdateData(BEFORE, { url: BEFORE.url })).toEqual({});
    expect(buildInsightUpdateData(BEFORE, { url: "https://example.com/fixed" })).toEqual(
      { url: "https://example.com/fixed" },
    );
  });
});

describe("buildInsightChanges", () => {
  it("변경 전후를 사람이 읽는 문자열로 만든다", () => {
    const data = buildInsightUpdateData(BEFORE, { views: 10_000, reach: 20 });
    expect(buildInsightChanges(BEFORE, data)).toEqual([
      "views: 1000000 → 10000",
      "reach: 없음 → 20",
    ]);
  });
});
