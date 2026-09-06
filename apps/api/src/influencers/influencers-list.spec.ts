import {
  EMPTY_INFLUENCER_FILTER,
  INFLUENCER_EXPORT_MAX_ROWS,
  InfluencerFilterSchema,
  influencerFilterToParams,
  parseInfluencerFilterParams,
  type InfluencerFilter,
} from "@jsure/shared";
import { InfluencersService } from "./influencers.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

describe("influencer 필터 직렬화", () => {
  const cases: InfluencerFilter[] = [
    EMPTY_INFLUENCER_FILTER,
    InfluencerFilterSchema.parse({ snsTypes: ["INSTAGRAM"] }),
    InfluencerFilterSchema.parse({ snsTypes: ["INSTAGRAM", "TIKTOK", "X"] }),
    InfluencerFilterSchema.parse({ query: "みか" }),
    InfluencerFilterSchema.parse({ snsTypes: ["X"], query: "handle" }),
  ];

  it.each(cases)("왕복해도 같은 필터가 된다: %j", (filter) => {
    expect(parseInfluencerFilterParams(influencerFilterToParams(filter))).toEqual(
      filter,
    );
  });

  it("빈 값은 파라미터에서 생략한다", () => {
    expect(influencerFilterToParams(EMPTY_INFLUENCER_FILTER)).toEqual({});
  });

  it("검색어 앞뒤 공백은 제거한다", () => {
    const filter = InfluencerFilterSchema.parse({ query: "  mika  " });
    expect(influencerFilterToParams(filter)).toEqual({ q: "mika" });
  });

  it("알 수 없는 SNS 값은 조용히 버린다", () => {
    expect(parseInfluencerFilterParams({ sns: "INSTAGRAM,LIPS,없음" })).toEqual(
      InfluencerFilterSchema.parse({ snsTypes: ["INSTAGRAM"] }),
    );
  });

  it("파라미터가 없으면 빈 필터가 된다", () => {
    expect(parseInfluencerFilterParams({})).toEqual(EMPTY_INFLUENCER_FILTER);
  });
});

type InfluencerRow = ReturnType<typeof makeRow>;

function makeRow(id: string) {
  return {
    id,
    email: `${id}@example.com`,
    name: id,
    nameKana: null,
    phone: "09000000000",
    status: "ACTIVE" as const,
    memo: null,
    flaggedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    addressCountry: "JP" as const,
    postalCode: "1000001",
    prefecture: "東京都",
    city: "千代田区",
    addressLine1: "1-1",
    addressLine2: "",
    snsAccounts: [{ snsType: "INSTAGRAM", handle: id, followerCount: 100 }],
  };
}

function makeService(rows: InfluencerRow[], total = rows.length) {
  const findMany = jest.fn().mockImplementation(({ take }: { take: number }) =>
    Promise.resolve(rows.slice(0, take)),
  );
  const count = jest.fn().mockResolvedValue(total);
  const prisma = {
    influencer: { findMany, count },
    campaignApplication: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  const service = new InfluencersService(prisma, {} as AuditService);
  return { service, findMany, count, prisma };
}

describe("InfluencersService.listForAdminPage", () => {
  it("SNS 미선택·검색어 없음이면 조건 없이 조회한다", async () => {
    const { service, findMany, count } = makeService([]);
    await service.listForAdminPage(EMPTY_INFLUENCER_FILTER, null, 30);
    expect(findMany.mock.calls[0]?.[0].where).toEqual({});
    // total 은 목록과 같은 조건으로 센다.
    expect(count.mock.calls[0]?.[0].where).toEqual({});
  });

  it("선택한 SNS 중 하나라도 보유하면 포함하는 조건을 만든다", async () => {
    const { service, findMany, count } = makeService([]);
    await service.listForAdminPage(
      InfluencerFilterSchema.parse({ snsTypes: ["INSTAGRAM", "X"] }),
      null,
      30,
    );
    const where = findMany.mock.calls[0]?.[0].where;
    expect(where).toEqual({
      AND: [{ snsAccounts: { some: { snsType: { in: ["INSTAGRAM", "X"] } } } }],
    });
    expect(count.mock.calls[0]?.[0].where).toEqual(where);
  });

  it("검색어는 이름·이메일·핸들을 대소문자 구분 없이 훑는다", async () => {
    const { service, findMany } = makeService([]);
    await service.listForAdminPage(
      InfluencerFilterSchema.parse({ query: " Mika " }),
      null,
      30,
    );
    expect(findMany.mock.calls[0]?.[0].where).toEqual({
      AND: [
        {
          OR: [
            { name: { contains: "Mika", mode: "insensitive" } },
            { email: { contains: "Mika", mode: "insensitive" } },
            {
              snsAccounts: {
                some: { handle: { contains: "Mika", mode: "insensitive" } },
              },
            },
          ],
        },
      ],
    });
  });

  it("다음 페이지가 있으면 마지막 행 id 를 커서로 돌려준다", async () => {
    const rows = ["a", "b", "c"].map(makeRow);
    const { service, findMany } = makeService(rows, 3);
    const page = await service.listForAdminPage(EMPTY_INFLUENCER_FILTER, null, 2);
    // 다음 페이지 존재 판정을 위해 limit + 1 건을 받는다.
    expect(findMany.mock.calls[0]?.[0].take).toBe(3);
    expect(page.influencers.map((row) => row.id)).toEqual(["a", "b"]);
    expect(page.nextCursor).toBe("b");
    expect(page.total).toBe(3);
  });

  it("마지막 페이지면 커서가 null 이다", async () => {
    const rows = ["a", "b"].map(makeRow);
    const { service } = makeService(rows, 2);
    const page = await service.listForAdminPage(EMPTY_INFLUENCER_FILTER, null, 2);
    expect(page.influencers).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("커서를 받으면 그 행 다음부터 읽는다", async () => {
    const { service, findMany } = makeService([]);
    await service.listForAdminPage(EMPTY_INFLUENCER_FILTER, "b", 2);
    const args = findMany.mock.calls[0]?.[0];
    expect(args.cursor).toEqual({ id: "b" });
    expect(args.skip).toBe(1);
  });

  it("total 은 커서·limit 과 무관하게 필터 전체 인원수다", async () => {
    const rows = ["a", "b", "c"].map(makeRow);
    const { service, count } = makeService(rows, 1250);
    const page = await service.listForAdminPage(
      InfluencerFilterSchema.parse({ snsTypes: ["INSTAGRAM"] }),
      "a",
      2,
    );
    expect(page.total).toBe(1250);
    expect(count.mock.calls[0]?.[0]).not.toHaveProperty("cursor");
    expect(count.mock.calls[0]?.[0]).not.toHaveProperty("take");
  });

  it("크로스포스트 집계는 이 페이지의 인플루언서로만 좁힌다", async () => {
    const rows = ["a", "b"].map(makeRow);
    const { service, prisma } = makeService(rows, 2);
    await service.listForAdminPage(EMPTY_INFLUENCER_FILTER, null, 2);
    const crossPostFindMany = (
      prisma as unknown as {
        campaignApplication: { findMany: jest.Mock };
      }
    ).campaignApplication.findMany;
    expect(crossPostFindMany.mock.calls[0]?.[0].where.influencerId).toEqual({
      in: ["a", "b"],
    });
  });
});

describe("InfluencersService.exportForAdmin", () => {
  it("목록과 같은 조건을 쓰고 커서는 쓰지 않는다", async () => {
    const { service, findMany } = makeService([]);
    await service.exportForAdmin(
      InfluencerFilterSchema.parse({ snsTypes: ["TIKTOK"] }),
    );
    const args = findMany.mock.calls[0]?.[0];
    expect(args.where).toEqual({
      AND: [{ snsAccounts: { some: { snsType: { in: ["TIKTOK"] } } } }],
    });
    expect(args).not.toHaveProperty("cursor");
    expect(args.take).toBe(INFLUENCER_EXPORT_MAX_ROWS + 1);
  });

  it("상한 이하면 truncated 가 false 다", async () => {
    const { service } = makeService(["a", "b"].map(makeRow));
    const result = await service.exportForAdmin(EMPTY_INFLUENCER_FILTER);
    expect(result.influencers).toHaveLength(2);
    expect(result.truncated).toBe(false);
  });
});
