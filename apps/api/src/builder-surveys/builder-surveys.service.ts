import { Injectable, NotFoundException } from "@nestjs/common";
import {
  SurveyQuestionsSchema,
  type BuilderSurveyListItem,
  type BuilderSurveyPageResponse,
  type BuilderSurveyResponse,
  type CreateBuilderSurveyRequest,
  type UpdateBuilderSurveyRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

export const UNKNOWN_ADMIN_NAME = "unknown";

const SCHEMA_VERSION = 1;

type BuilderSurveyRow = {
  id: string;
  title: string;
  description: string | null;
  questions: unknown;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
};

/** 목록 조회가 실제로 쓰는 컬럼만. `questions`(JSONB) 를 끌어오지 않는다. */
type BuilderSurveyListRow = Pick<
  BuilderSurveyRow,
  "id" | "title" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"
>;

@Injectable()
export class BuilderSurveysService {
  constructor(private readonly prisma: PrismaService) {}

  private async adminNamesByIds(adminUserIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(adminUserIds)];
    const namesById = new Map<string, string>();
    if (uniqueIds.length === 0) return namesById;
    const adminUsers = await this.prisma.adminUser.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true },
    });
    for (const adminUser of adminUsers) {
      namesById.set(adminUser.id, adminUser.name ?? UNKNOWN_ADMIN_NAME);
    }
    return namesById;
  }

  private toListItem(
    row: BuilderSurveyListRow,
    namesById: Map<string, string>,
    responseCount: number,
  ): BuilderSurveyListItem {
    return {
      id: row.id,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      createdByName: namesById.get(row.createdBy) ?? UNKNOWN_ADMIN_NAME,
      updatedByName: namesById.get(row.updatedBy) ?? UNKNOWN_ADMIN_NAME,
      responseCount,
    };
  }

  private toResponse(
    row: BuilderSurveyRow,
    namesById: Map<string, string>,
    responseCount: number,
  ): BuilderSurveyResponse {
    return {
      ...this.toListItem(row, namesById, responseCount),
      description: row.description,
      questions: SurveyQuestionsSchema.parse(row.questions),
    };
  }

  /**
   * 설문별 응답자 수 일괄 조회 — 설문마다 세면 N+1 이라 한 번에 모아 읽는다.
   * 응답은 응모당 1건(applicationId 유니크)이라 건수가 곧 사람 수다.
   */
  private async responseCountsBySurveyIds(
    surveyIds: string[],
  ): Promise<Map<string, number>> {
    const countBySurveyId = new Map<string, number>();
    const uniqueSurveyIds = [...new Set(surveyIds)];
    if (uniqueSurveyIds.length === 0) return countBySurveyId;
    const grouped = await this.prisma.builderSurveyResponse.groupBy({
      by: ["surveyId"],
      where: { surveyId: { in: uniqueSurveyIds } },
      _count: { _all: true },
    });
    for (const group of grouped) {
      countBySurveyId.set(group.surveyId, group._count._all);
    }
    return countBySurveyId;
  }

  private notFound(): never {
    throw new NotFoundException({
      code: "SURVEY_NOT_FOUND",
      message: "앙케이트를 찾을 수 없습니다",
    });
  }

  /** 삭제되지 않은 설문을 찾는다. 없으면 404 — get/update/softDelete 가 공유한다. */
  private async findActiveOrThrow(id: string): Promise<BuilderSurveyRow> {
    const row = await this.prisma.builderSurvey.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) this.notFound();
    return row;
  }

  async listPage(
    cursor: string | null,
    limit: number,
    query?: string,
  ): Promise<BuilderSurveyPageResponse> {
    const trimmedQuery = query?.trim();
    const where = trimmedQuery
      ? {
          deletedAt: null,
          title: { contains: trimmedQuery, mode: "insensitive" as const },
        }
      : { deletedAt: null };
    const [rows, total] = await Promise.all([
      this.prisma.builderSurvey.findMany({
        where,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          createdBy: true,
          updatedBy: true,
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        // 한 건 더 받아 다음 페이지 존재를 판정한다.
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.prisma.builderSurvey.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const [namesById, responseCountBySurveyId] = await Promise.all([
      this.adminNamesByIds(pageRows.flatMap((row) => [row.createdBy, row.updatedBy])),
      this.responseCountsBySurveyIds(pageRows.map((row) => row.id)),
    ]);
    return {
      items: pageRows.map((row) =>
        this.toListItem(row, namesById, responseCountBySurveyId.get(row.id) ?? 0),
      ),
      nextCursor: hasMore ? (pageRows[pageRows.length - 1]?.id ?? null) : null,
      total,
    };
  }

  async get(id: string): Promise<BuilderSurveyResponse> {
    const row = await this.findActiveOrThrow(id);
    const [namesById, responseCount] = await Promise.all([
      this.adminNamesByIds([row.createdBy, row.updatedBy]),
      this.prisma.builderSurveyResponse.count({ where: { surveyId: id } }),
    ]);
    return this.toResponse(row, namesById, responseCount);
  }

  async create(
    adminUserId: string,
    body: CreateBuilderSurveyRequest,
  ): Promise<BuilderSurveyResponse> {
    const row = await this.prisma.builderSurvey.create({
      data: {
        title: body.title,
        description: body.description ?? null,
        questions: body.questions,
        schemaVersion: SCHEMA_VERSION,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      },
    });
    const namesById = await this.adminNamesByIds([adminUserId]);
    // 방금 만든 설문이라 응답이 있을 수 없다 — 세지 않는다.
    return this.toResponse(row, namesById, 0);
  }

  async update(
    id: string,
    adminUserId: string,
    body: UpdateBuilderSurveyRequest,
  ): Promise<BuilderSurveyResponse> {
    await this.findActiveOrThrow(id);

    const row = await this.prisma.builderSurvey.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description ?? null,
        questions: body.questions,
        updatedBy: adminUserId,
      },
    });
    const [namesById, responseCount] = await Promise.all([
      this.adminNamesByIds([row.createdBy, row.updatedBy]),
      this.prisma.builderSurveyResponse.count({ where: { surveyId: id } }),
    ]);
    return this.toResponse(row, namesById, responseCount);
  }

  async softDelete(id: string): Promise<void> {
    await this.findActiveOrThrow(id);
    await this.prisma.builderSurvey.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
