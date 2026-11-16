import type { Prisma } from "@prisma/client";
import { BuilderSurveysService, UNKNOWN_ADMIN_NAME } from "./builder-surveys.service";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "survey-1",
    title: "제목",
    description: "설명",
    questions: [
      {
        id: "q1",
        type: "TEXT",
        title: "문항",
        required: true,
        multiline: false,
      },
    ],
    schemaVersion: 1,
    createdBy: "admin-1",
    updatedBy: "admin-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
    deletedAt: null,
    ...overrides,
  };
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => makeRow({ id: `survey-${index + 1}` }));
}

function makeService(overrides?: {
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
  create?: jest.Mock;
  update?: jest.Mock;
  count?: jest.Mock;
  deleteRow?: jest.Mock;
  adminUserFindMany?: jest.Mock;
}) {
  const prisma = {
    builderSurvey: {
      findMany: overrides?.findMany ?? jest.fn(async () => []),
      findFirst: overrides?.findFirst ?? jest.fn(async () => null),
      create: overrides?.create ?? jest.fn(async () => makeRow()),
      update: overrides?.update ?? jest.fn(async () => makeRow()),
      count: overrides?.count ?? jest.fn(async () => 0),
      delete: overrides?.deleteRow ?? jest.fn(),
    },
    adminUser: {
      findMany: overrides?.adminUserFindMany ?? jest.fn(async () => []),
    },
  };
  return { service: new BuilderSurveysService(prisma as never), prisma };
}

describe("BuilderSurveysService", () => {
  it("limit+1 을 받아 nextCursor 를 마지막 행 id 로 돌려준다", async () => {
    const rows = makeRows(31);
    const findMany = jest.fn(async () => rows);
    const { service } = makeService({
      findMany,
      count: jest.fn(async () => 31),
    });

    const page = await service.listPage(null, 30);

    expect(page.items).toHaveLength(30);
    expect(page.nextCursor).toBe("survey-30");
  });

  it("마지막 페이지면 nextCursor 가 null 이다", async () => {
    const rows = makeRows(5);
    const findMany = jest.fn(async () => rows);
    const { service } = makeService({
      findMany,
      count: jest.fn(async () => 5),
    });

    const page = await service.listPage(null, 30);

    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it("정렬은 updatedAt desc, id desc 두 키를 쓴다", async () => {
    const findMany = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindManyArgs) => []);
    const { service } = makeService({ findMany });

    await service.listPage(null, 30);

    expect(findMany.mock.calls[0]?.[0]?.orderBy).toEqual([{ updatedAt: "desc" }, { id: "desc" }]);
  });

  it("목록·조회는 deletedAt: null 로 거른다", async () => {
    const findMany = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindManyArgs) => []);
    const findFirst = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindFirstArgs) => makeRow());
    const { service } = makeService({ findMany, findFirst });

    await service.listPage(null, 30);
    await service.get("survey-1");

    expect(findMany.mock.calls[0]?.[0]?.where).toEqual({ deletedAt: null });
    expect(findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      deletedAt: null,
    });
  });

  it("삭제된 설문 조회는 NotFoundException", async () => {
    const findFirst = jest.fn(async () => null);
    const { service } = makeService({ findFirst });

    await expect(service.get("survey-1")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("삭제된 설문 수정은 NotFoundException 이고 update 를 호출하지 않는다", async () => {
    const findFirst = jest.fn(async () => null);
    const update = jest.fn(async () => makeRow());
    const { service } = makeService({ findFirst, update });

    await expect(
      service.update("survey-1", "admin-1", {
        title: "수정",
        questions: [
          {
            id: "q1",
            type: "TEXT",
            title: "문항",
            required: true,
            multiline: false,
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(update).not.toHaveBeenCalled();
  });

  it("작성자 이름이 비면 unknown 으로 채운다", async () => {
    const row = makeRow({ createdBy: "u1", updatedBy: "u2" });
    const findFirst = jest.fn(async () => row);
    const adminUserFindMany = jest.fn(async () => [{ id: "u1", name: null }]);
    const { service } = makeService({ findFirst, adminUserFindMany });

    const response = await service.get("survey-1");

    expect(response.createdByName).toBe(UNKNOWN_ADMIN_NAME);
    expect(response.updatedByName).toBe(UNKNOWN_ADMIN_NAME);
  });

  it("삭제는 deletedAt 을 채우고 행을 지우지 않는다", async () => {
    const findFirst = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindFirstArgs) => makeRow());
    const update = jest.fn(async (_queryArgs: Prisma.BuilderSurveyUpdateArgs) => makeRow());
    const deleteRow = jest.fn();
    const { service } = makeService({ findFirst, update, deleteRow });

    await service.softDelete("survey-1");

    expect(update.mock.calls[0]?.[0]?.data?.deletedAt).toBeInstanceOf(Date);
    expect(deleteRow).not.toHaveBeenCalled();
  });

  it("삭제된(또는 없는) 설문을 다시 삭제하면 NotFoundException 이고 update 를 호출하지 않는다", async () => {
    const findFirst = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindFirstArgs) => null);
    const update = jest.fn(async (_queryArgs: Prisma.BuilderSurveyUpdateArgs) => makeRow());
    const { service } = makeService({ findFirst, update });

    await expect(service.softDelete("survey-1")).rejects.toMatchObject({
      status: 404,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("create 는 schemaVersion 1 과 createdBy=updatedBy=요청자로 저장한다", async () => {
    const create = jest.fn(async (_queryArgs: Prisma.BuilderSurveyCreateArgs) => makeRow());
    const { service } = makeService({ create });

    await service.create("admin-1", {
      title: "제목",
      questions: [
        {
          id: "q1",
          type: "TEXT",
          title: "문항",
          required: true,
          multiline: false,
        },
      ],
    });

    expect(create.mock.calls[0]?.[0]?.data).toMatchObject({
      schemaVersion: 1,
      createdBy: "admin-1",
      updatedBy: "admin-1",
    });
  });

  it("update 는 updatedBy 만 바꾸고 createdBy 는 건드리지 않는다", async () => {
    const findFirst = jest.fn(async (_queryArgs: Prisma.BuilderSurveyFindFirstArgs) => makeRow());
    const update = jest.fn(async (_queryArgs: Prisma.BuilderSurveyUpdateArgs) => makeRow());
    const { service } = makeService({ findFirst, update });

    await service.update("survey-1", "admin-2", {
      title: "수정",
      questions: [
        {
          id: "q1",
          type: "TEXT",
          title: "문항",
          required: true,
          multiline: false,
        },
      ],
    });

    expect(update.mock.calls[0]?.[0]?.data).toMatchObject({
      updatedBy: "admin-2",
    });
    expect(update.mock.calls[0]?.[0]?.data).not.toHaveProperty("createdBy");
  });
});
