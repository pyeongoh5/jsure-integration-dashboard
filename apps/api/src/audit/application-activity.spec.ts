import { toActivityLog } from "./application-activity";

describe("toActivityLog", () => {
  it("actorId 가 있으면 actor 를 스냅샷 이름과 함께 만든다", () => {
    const result = toActivityLog({
      id: "log-1",
      action: "APPLICATION_APPROVE",
      origin: "ADMIN",
      actorId: "admin-1",
      actorName: "오피디",
      metadata: null,
      createdAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(result).toEqual({
      id: "log-1",
      action: "APPLICATION_APPROVE",
      origin: "ADMIN",
      actor: { id: "admin-1", name: "오피디" },
      metadata: null,
      createdAt: "2026-08-10T01:02:03.000Z",
    });
  });

  it("actorId 가 없으면 actor 는 null", () => {
    const result = toActivityLog({
      id: "log-2",
      action: "SETTLEMENT_AUTO_COMPLETE",
      origin: "SYSTEM",
      actorId: null,
      actorName: null,
      metadata: { triggeredBy: "INSIGHT_SUBMITTED" },
      createdAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(result.actor).toBeNull();
    expect(result.metadata).toEqual({ triggeredBy: "INSIGHT_SUBMITTED" });
  });

  it("객체가 아닌 metadata(JSON 스칼라/배열)는 null 로 떨군다", () => {
    expect(
      toActivityLog({
        id: "log-3",
        action: "APPLICATION_DELIVER",
        origin: "ADMIN",
        actorId: "admin-1",
        actorName: null,
        metadata: [1, 2],
        createdAt: new Date("2026-08-10T01:02:03.000Z"),
      }).metadata,
    ).toBeNull();
  });

  it("등록되지 않은 action 문자열은 파싱 실패로 걸러낸다", () => {
    expect(() =>
      toActivityLog({
        id: "log-4",
        action: "UNKNOWN_LEGACY_ACTION",
        origin: "ADMIN",
        actorId: null,
        actorName: null,
        metadata: null,
        createdAt: new Date("2026-08-10T01:02:03.000Z"),
      }),
    ).toThrow();
  });
});
