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
    reviewedAt: null,
    reviewedBy: null,
    ...overrides,
  };
}

const REJECTED = {
  status: "REJECTED",
  rejectReason: "前回落選",
  reviewedAt: new Date("2026-08-03T00:00:00.000Z"),
  reviewedBy: { id: "admin-9", name: "카린" },
} satisfies Partial<InfluencerHistoryApplicationRow>;

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

  it("감사 로그 이전 반려 건은 reviewedAt/reviewedBy 로 반려 이벤트를 복원한다", () => {
    const groups = influencerHistoryGroups([makeApplication(REJECTED)], []);

    const reject = groups[0]!.events.find(
      (event) => event.action === "APPLICATION_REJECT",
    );
    expect(reject).toBeDefined();
    expect(reject!.origin).toBe("ADMIN");
    expect(reject!.actor).toEqual({ id: "admin-9", name: "카린" });
    expect(reject!.metadata).toEqual({ reason: "前回落選" });
    expect(reject!.createdAt).toBe("2026-08-03T00:00:00.000Z");
  });

  it("처리자를 모르는 옛 반려 건은 시스템 처리로 복원한다", () => {
    const groups = influencerHistoryGroups(
      [makeApplication({ ...REJECTED, reviewedBy: null, rejectReason: null })],
      [],
    );

    const reject = groups[0]!.events.find(
      (event) => event.action === "APPLICATION_REJECT",
    )!;
    expect(reject.origin).toBe("SYSTEM");
    expect(reject.actor).toBeNull();
    expect(reject.metadata).toBeNull();
  });

  it("반려 로그가 이미 있으면 합성하지 않는다", () => {
    const groups = influencerHistoryGroups(
      [makeApplication(REJECTED)],
      [makeLog({ action: "APPLICATION_REJECT" })],
    );

    const rejects = groups[0]!.events.filter(
      (event) => event.action === "APPLICATION_REJECT",
    );
    expect(rejects).toHaveLength(1);
    expect(rejects[0]!.id).toBe("log-1");
  });

  it("반려가 아니면 검토 시각이 있어도 합성하지 않는다", () => {
    const groups = influencerHistoryGroups(
      [makeApplication({ ...REJECTED, status: "APPROVED" })],
      [],
    );

    expect(groups[0]!.events.map((event) => event.action)).toEqual([
      "APPLICATION_APPLY",
    ]);
  });

  // 화면이 이벤트 id 를 React key 로 쓴다 — 한 그룹 안에서 겹치면 행이 사라진다.
  it("합성 항목이 모두 들어찬 그룹에서도 이벤트 id 는 겹치지 않는다", () => {
    const at = new Date("2026-08-05T00:00:00.000Z");
    const groups = influencerHistoryGroups(
      [
        makeApplication({
          ...REJECTED,
          orderSubmittedAt: at,
          receivedAt: at,
          posts: [
            { subType: "INSTAGRAM", submittedAt: at, insightSubmittedAt: at },
            { subType: "TIKTOK", submittedAt: at, insightSubmittedAt: at },
          ],
        }),
      ],
      [makeLog(), makeLog({ id: "log-2", action: "APPLICATION_SHIP" })],
    );

    const ids = groups[0]!.events.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("synthetic-application-reject");
  });

  it("취소는 세부 탭에 걸리지 않고, 진행 중 상태는 응모 탭에 묶인다", () => {
    expect(INFLUENCER_HISTORY_TAB.CANCELLED).toBeNull();
    expect(INFLUENCER_HISTORY_TAB.SHIPPED).toBe("APPLIED");
    expect(INFLUENCER_HISTORY_TAB.REVIEW_SUBMITTED).toBe("APPLIED");
    expect(INFLUENCER_HISTORY_TAB.COMPLETED).toBe("COMPLETED");
    expect(INFLUENCER_HISTORY_TAB.REJECTED).toBe("REJECTED");
  });
});
