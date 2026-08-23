import { INFLUENCER_HISTORY_TAB } from "@jsure/shared";
import {
  influencerHistoryGroups,
  type InfluencerHistoryApplicationRow,
  type InfluencerHistoryLogRow,
} from "./influencer-history";

function makeApplication(
  overrides: Partial<InfluencerHistoryApplicationRow> = {},
): InfluencerHistoryApplicationRow {
  return {
    id: "application-1",
    status: "APPLIED",
    rejectReason: null,
    subTypes: ["INSTAGRAM"],
    campaign: { id: "campaign-1", title: "여름 신제품 체험단" },
    appliedAt: new Date("2026-08-01T00:00:00.000Z"),
    orderSubmittedAt: null,
    receivedAt: null,
    posts: [],
    ...overrides,
  };
}

function makeLog(
  overrides: Partial<InfluencerHistoryLogRow> = {},
): InfluencerHistoryLogRow {
  return {
    id: "log-1",
    applicationId: "application-1",
    action: "APPLICATION_APPROVE",
    origin: "ADMIN",
    actorId: "admin-1",
    actorName: "김담당",
    metadata: null,
    createdAt: new Date("2026-08-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("influencerHistoryGroups", () => {
  it("응모별로 그룹을 만들고 이벤트를 최신순으로 정렬한다", () => {
    const groups = influencerHistoryGroups(
      [makeApplication()],
      [makeLog()],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]!.applicationId).toBe("application-1");
    expect(groups[0]!.campaignTitle).toBe("여름 신제품 체험단");
    expect(groups[0]!.events.map((event) => event.action)).toEqual([
      "APPLICATION_APPROVE",
      "APPLICATION_APPLY",
    ]);
  });

  it("다른 응모의 로그가 섞이지 않는다", () => {
    const groups = influencerHistoryGroups(
      [
        makeApplication(),
        makeApplication({
          id: "application-2",
          campaign: { id: "campaign-2", title: "가을 캠페인" },
          appliedAt: new Date("2026-07-01T00:00:00.000Z"),
        }),
      ],
      [makeLog(), makeLog({ id: "log-2", applicationId: "application-2" })],
    );

    const eventsByApplication = new Map(
      groups.map((group) => [group.applicationId, group.events]),
    );
    expect(eventsByApplication.get("application-1")!.map((event) => event.id)).toEqual([
      "log-1",
      "synthetic-apply",
    ]);
    expect(eventsByApplication.get("application-2")!.map((event) => event.id)).toEqual([
      "log-2",
      "synthetic-apply",
    ]);
  });

  it("applicationId 없는 로그는 버린다", () => {
    const groups = influencerHistoryGroups(
      [makeApplication()],
      [makeLog({ id: "log-memo", applicationId: null, action: "INFLUENCER_MEMO_CREATE" })],
    );

    expect(groups[0]!.events.map((event) => event.action)).toEqual([
      "APPLICATION_APPLY",
    ]);
  });

  it("그룹은 최신 이벤트 기준 내림차순", () => {
    const groups = influencerHistoryGroups(
      [
        makeApplication({
          id: "old",
          appliedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        makeApplication({
          id: "recent",
          appliedAt: new Date("2026-08-20T00:00:00.000Z"),
        }),
      ],
      [],
    );

    expect(groups.map((group) => group.applicationId)).toEqual(["recent", "old"]);
  });

  it("취소는 세부 탭에 걸리지 않고, 진행 중 상태는 응모 탭에 묶인다", () => {
    expect(INFLUENCER_HISTORY_TAB.CANCELLED).toBeNull();
    expect(INFLUENCER_HISTORY_TAB.SHIPPED).toBe("APPLIED");
    expect(INFLUENCER_HISTORY_TAB.REVIEW_SUBMITTED).toBe("APPLIED");
    expect(INFLUENCER_HISTORY_TAB.COMPLETED).toBe("COMPLETED");
    expect(INFLUENCER_HISTORY_TAB.REJECTED).toBe("REJECTED");
  });
});
