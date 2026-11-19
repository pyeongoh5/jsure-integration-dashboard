import type { CampaignBoardRow, CampaignStage } from "@jsure/shared";
import { paginateCampaignBoard } from "./campaign-board-page";

const STAGES: CampaignStage[] = [
  "OPEN_PENDING",
  "IN_PROGRESS",
  "INSIGHT_COLLECTING",
  "SETTLEMENT_PENDING",
];

function rowsOf(count: number): CampaignBoardRow[] {
  return Array.from({ length: count }, (_, index) => ({
    campaignId: `c${index}`,
    title: `캠페인 ${index}`,
    tags: [],
    category: "SNS" as const,
    stage: STAGES[index % STAGES.length] ?? "IN_PROGRESS",
  }));
}

describe("paginateCampaignBoard", () => {
  it("한 페이지에 15건까지만 담고 전체 건수를 함께 돌려준다", () => {
    const result = paginateCampaignBoard(rowsOf(20), { stage: null, page: 0 });
    expect(result.rows).toHaveLength(15);
    expect(result.rows[0]?.campaignId).toBe("c0");
    expect(result.total).toBe(20);
  });

  it("다음 페이지는 남은 행만 담는다", () => {
    const result = paginateCampaignBoard(rowsOf(20), { stage: null, page: 1 });
    expect(result.rows.map((row) => row.campaignId)).toEqual(["c15", "c16", "c17", "c18", "c19"]);
  });

  it("단계 카운터는 단계 필터와 무관하게 전체를 센다", () => {
    const result = paginateCampaignBoard(rowsOf(20), {
      stage: "IN_PROGRESS",
      page: 0,
    });
    expect(result.stageCounts).toEqual({
      OPEN_PENDING: 5,
      IN_PROGRESS: 5,
      INSIGHT_COLLECTING: 5,
      SETTLEMENT_PENDING: 5,
    });
    // 목록과 total 은 고른 단계만 반영한다.
    expect(result.total).toBe(5);
    expect(result.rows.every((row) => row.stage === "IN_PROGRESS")).toBe(true);
  });

  it("요청한 페이지가 범위를 넘으면 마지막 페이지를 돌려준다", () => {
    const result = paginateCampaignBoard(rowsOf(20), { stage: null, page: 9 });
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0]?.campaignId).toBe("c15");
  });

  it("행이 없으면 빈 목록과 0 집계", () => {
    const result = paginateCampaignBoard([], { stage: null, page: 3 });
    expect(result.rows).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.stageCounts.IN_PROGRESS).toBe(0);
  });
});
