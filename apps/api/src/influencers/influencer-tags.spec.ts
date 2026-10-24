import { NotFoundException } from "@nestjs/common";
import { InfluencersService } from "./influencers.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService, AuditActor } from "../audit/audit.service";

const actor: AuditActor = { id: "admin-1", name: "운영자" };

function makeMocks(influencerExists = true) {
  const upsert = jest.fn(({ create }: { create: { label: string } }) =>
    Promise.resolve({ id: `tag-${create.label}`, label: create.label }),
  );
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const createMany = jest.fn().mockResolvedValue({ count: 0 });
  // 트랜잭션 콜백이 받는 클라이언트 — 바깥 prisma 와 같은 mock 을 공유한다.
  const tx = {
    influencerTag: { upsert, findMany: jest.fn().mockResolvedValue([]) },
    influencerTagAssignment: { deleteMany, createMany },
  };
  const prisma = {
    influencer: {
      findUnique: jest
        .fn()
        .mockResolvedValue(influencerExists ? { id: "inf-1" } : null),
    },
    ...tx,
    $transaction: jest.fn((run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new InfluencersService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service, upsert, deleteMany, createMany };
}

describe("InfluencersService.updateTags", () => {
  it("마스터에 없는 라벨은 만들고, 남길 태그만 빼고 연결을 끊는다", async () => {
    const { service, audit, upsert, deleteMany, createMany } = makeMocks();

    const result = await service.updateTags("inf-1", actor, [
      "한국거주",
      "고퀄리티",
    ]);

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        influencerId: "inf-1",
        NOT: { tagId: { in: ["tag-한국거주", "tag-고퀄리티"] } },
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { influencerId: "inf-1", tagId: "tag-한국거주", createdById: "admin-1" },
        { influencerId: "inf-1", tagId: "tag-고퀄리티", createdById: "admin-1" },
      ],
      skipDuplicates: true,
    });
    expect(result.tags).toEqual(["고퀄리티", "한국거주"]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "INFLUENCER_TAGS_UPDATE",
        influencerId: "inf-1",
        metadata: { tags: ["고퀄리티", "한국거주"] },
      }),
    );
  });

  it("같은 라벨이 두 번 와도 한 번만 단다", async () => {
    const { service, upsert, createMany } = makeMocks();

    await service.updateTags("inf-1", actor, ["한국거주", "한국거주"]);

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { influencerId: "inf-1", tagId: "tag-한국거주", createdById: "admin-1" },
      ],
      skipDuplicates: true,
    });
  });

  it("빈 배열이면 모든 연결을 끊는다", async () => {
    const { service, deleteMany, createMany } = makeMocks();

    const result = await service.updateTags("inf-1", actor, []);

    // NOT in [] 는 전체 행에 해당한다 — 태그를 모두 지우는 경로.
    expect(deleteMany).toHaveBeenCalledWith({
      where: { influencerId: "inf-1", NOT: { tagId: { in: [] } } },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [],
      skipDuplicates: true,
    });
    expect(result.tags).toEqual([]);
  });

  it("없는 인플루언서면 404 이고 아무것도 쓰지 않는다", async () => {
    const { service, audit, upsert } = makeMocks(false);

    await expect(service.updateTags("none", actor, ["한국거주"])).rejects.toThrow(
      NotFoundException,
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
