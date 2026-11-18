import { describe, expect, it } from "vitest";
import { deriveCampaignStage } from "./adminOverview.js";

describe("deriveCampaignStage", () => {
  it("모집 시작 전이면 오픈 준비중", () => {
    expect(
      deriveCampaignStage({
        recruitStarted: false,
        approvedCount: 3,
        insightStartedCount: 3,
        settledCount: 3,
      }),
    ).toBe("OPEN_PENDING");
  });

  it("승인자가 아직 없으면 진행중", () => {
    expect(
      deriveCampaignStage({
        recruitStarted: true,
        approvedCount: 0,
        insightStartedCount: 0,
        settledCount: 0,
      }),
    ).toBe("IN_PROGRESS");
  });

  it("인사이트를 1명이라도 내기 시작하면 인사이트 회수", () => {
    expect(
      deriveCampaignStage({
        recruitStarted: true,
        approvedCount: 5,
        insightStartedCount: 1,
        settledCount: 0,
      }),
    ).toBe("INSIGHT_COLLECTING");
  });

  it("승인 인원 전원의 회수가 끝나면 정산/종료 대기", () => {
    expect(
      deriveCampaignStage({
        recruitStarted: true,
        approvedCount: 5,
        insightStartedCount: 5,
        settledCount: 5,
      }),
    ).toBe("SETTLEMENT_PENDING");
  });

  it("인사이트가 없는 카테고리도 전원 정산 생성되면 정산/종료 대기", () => {
    expect(
      deriveCampaignStage({
        recruitStarted: true,
        approvedCount: 2,
        insightStartedCount: 0,
        settledCount: 2,
      }),
    ).toBe("SETTLEMENT_PENDING");
  });
});
