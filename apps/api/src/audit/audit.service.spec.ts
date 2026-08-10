import { AuditService } from "./audit.service";

type CreateArgs = { data: Record<string, unknown> };

function makeService(overrides?: {
  onCreate?: (args: CreateArgs) => void;
  onCreateMany?: (args: { data: Record<string, unknown>[] }) => void;
  failCreate?: boolean;
}) {
  const prisma = {
    adminActivityLog: {
      create: async (args: CreateArgs) => {
        if (overrides?.failCreate) throw new Error("DB down");
        overrides?.onCreate?.(args);
        return { id: "log-1" };
      },
      createMany: async (args: { data: Record<string, unknown>[] }) => {
        if (overrides?.failCreate) throw new Error("DB down");
        overrides?.onCreateMany?.(args);
        return { count: args.data.length };
      },
    },
  };
  // PrismaService 전체를 목킹하지 않고 사용하는 delegate 만 제공한다.
  return new AuditService(prisma as never);
}

describe("AuditService.record", () => {
  it("액터와 대상 참조를 그대로 저장하고 origin 기본값은 ADMIN", async () => {
    let created: CreateArgs | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args;
      },
    });

    await service.record({
      action: "APPLICATION_APPROVE",
      actor: { id: "admin-1", name: "오피디" },
      applicationId: "app-1",
    });

    const data = created!.data;
    expect(data.action).toBe("APPLICATION_APPROVE");
    expect(data.origin).toBe("ADMIN");
    expect(data.actorId).toBe("admin-1");
    expect(data.actorName).toBe("오피디");
    expect(data.applicationId).toBe("app-1");
    expect(data.campaignId).toBeNull();
    // metadata 미지정은 undefined 로 남겨 컬럼을 건드리지 않는다.
    expect(data.metadata).toBeUndefined();
  });

  it("actor 를 생략하면 actorId/actorName 이 null 이고 origin 을 명시할 수 있다", async () => {
    let created: CreateArgs | null = null;
    const service = makeService({
      onCreate: (args) => {
        created = args;
      },
    });

    await service.record({
      action: "SETTLEMENT_AUTO_COMPLETE",
      origin: "SYSTEM",
      applicationId: "app-1",
      settlementId: "settle-1",
      metadata: { triggeredBy: "INSIGHT_SUBMITTED" },
    });

    const data = created!.data;
    expect(data.origin).toBe("SYSTEM");
    expect(data.actorId).toBeNull();
    expect(data.actorName).toBeNull();
    expect(data.settlementId).toBe("settle-1");
    expect(data.metadata).toEqual({ triggeredBy: "INSIGHT_SUBMITTED" });
  });

  it("기록이 실패해도 예외를 밖으로 던지지 않는다 (best-effort)", async () => {
    const service = makeService({ failCreate: true });

    await expect(
      service.record({ action: "APPLICATION_APPROVE", applicationId: "app-1" }),
    ).resolves.toBeUndefined();
  });
});

describe("AuditService.recordMany", () => {
  it("여러 entry 를 createMany 1회로 기록한다", async () => {
    let createManyArgs: { data: Record<string, unknown>[] } | null = null;
    const service = makeService({
      onCreateMany: (args) => {
        createManyArgs = args;
      },
    });

    await service.recordMany([
      {
        action: "SETTLEMENT_COMPLETE",
        actor: { id: "admin-1", name: null },
        applicationId: "app-1",
        settlementId: "settle-1",
        metadata: { batchSize: 2 },
      },
      {
        action: "SETTLEMENT_COMPLETE",
        actor: { id: "admin-1", name: null },
        applicationId: "app-2",
        settlementId: "settle-2",
        metadata: { batchSize: 2 },
      },
    ]);

    expect(createManyArgs!.data).toHaveLength(2);
    expect(createManyArgs!.data[0]!.settlementId).toBe("settle-1");
    expect(createManyArgs!.data[1]!.applicationId).toBe("app-2");
  });

  it("빈 배열이면 아무것도 호출하지 않는다", async () => {
    let calls = 0;
    const service = makeService({
      onCreateMany: () => {
        calls += 1;
      },
    });

    await service.recordMany([]);

    expect(calls).toBe(0);
  });

  it("일괄 기록 실패도 삼킨다", async () => {
    const service = makeService({ failCreate: true });

    await expect(
      service.recordMany([
        { action: "SETTLEMENT_COMPLETE", settlementId: "settle-1" },
      ]),
    ).resolves.toBeUndefined();
  });
});
