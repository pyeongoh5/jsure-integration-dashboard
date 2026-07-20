import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  UpdateLineMessageTemplateRequest,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { listTriggersForCategory, publicVariables, getMeta } from "./trigger-meta";
import { renderTemplate, validateBodyVariables } from "./template-renderer";

@Injectable()
export class AdminLineTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  async list(category: CampaignCategory): Promise<LineMessageTemplateListResponse> {
    const triggerKeys = listTriggersForCategory(category);
    const rows = await this.prisma.lineMessageTemplate.findMany({
      where: { category },
      select: {
        triggerKey: true,
        enabled: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    });
    const byKey = new Map(rows.map((row) => [row.triggerKey, row]));
    return {
      category,
      items: triggerKeys.map((triggerKey) => {
        const row = byKey.get(triggerKey);
        return {
          triggerKey,
          enabled: row?.enabled ?? false,
          updatedAt: row?.updatedAt?.toISOString() ?? null,
          updatedByName: row?.updatedBy?.name ?? null,
        };
      }),
    };
  }

  async detail(
    category: CampaignCategory,
    triggerKey: LineTriggerKey,
  ): Promise<LineMessageTemplateDetailResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    const row = await this.prisma.lineMessageTemplate.findUnique({
      where: { category_triggerKey: { category, triggerKey } },
      include: { updatedBy: { select: { name: true } } },
    });
    const template: LineMessageTemplateResponse = row
      ? {
          category: row.category,
          // where 가 triggerKey 로 unique 조회라 파라미터와 동일 — shared 타입 유지용
          triggerKey,
          enabled: row.enabled,
          body: row.body,
          updatedAt: row.updatedAt.toISOString(),
          updatedById: row.updatedById,
          updatedByName: row.updatedBy?.name ?? null,
        }
      : {
          category,
          triggerKey,
          enabled: false,
          body: "",
          updatedAt: null,
          updatedById: null,
          updatedByName: null,
        };
    return {
      template,
      variables: publicVariables(triggerKey),
    };
  }

  async update(
    category: CampaignCategory,
    triggerKey: LineTriggerKey,
    updatedById: string,
    input: UpdateLineMessageTemplateRequest,
  ): Promise<LineMessageTemplateResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    const validation = validateBodyVariables(input.body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const row = await this.prisma.lineMessageTemplate.upsert({
      where: { category_triggerKey: { category, triggerKey } },
      create: {
        category,
        triggerKey,
        enabled: false,
        body: input.body,
        updatedById,
      },
      update: {
        body: input.body,
        updatedById,
      },
      include: { updatedBy: { select: { name: true } } },
    });
    return {
      category: row.category,
      triggerKey,
      enabled: row.enabled,
      body: row.body,
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
      updatedByName: row.updatedBy?.name ?? null,
    };
  }

  async setEnabled(
    category: CampaignCategory,
    triggerKey: LineTriggerKey,
    updatedById: string,
    enabled: boolean,
  ): Promise<LineMessageTemplateResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    // 시드 누락 등으로 row 가 없어도 토글이 가능하도록 upsert. 본문이 비어있는 경우
    // 실제 발송 시점(line-dispatcher.service.ts) 에서 렌더된 본문 길이 0 이면 스킵.
    const row = await this.prisma.lineMessageTemplate.upsert({
      where: { category_triggerKey: { category, triggerKey } },
      create: {
        category,
        triggerKey,
        enabled,
        body: "",
        updatedById,
      },
      update: { enabled, updatedById },
      include: { updatedBy: { select: { name: true } } },
    });
    return {
      category: row.category,
      triggerKey,
      enabled: row.enabled,
      body: row.body,
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
      updatedByName: row.updatedBy?.name ?? null,
    };
  }

  async preview(triggerKey: LineTriggerKey, body: string): Promise<{ renderedBody: string }> {
    const meta = getMeta(triggerKey);
    const validation = validateBodyVariables(body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const renderedBody = renderTemplate(body, meta.variables, {} as never, { useSample: true });
    return { renderedBody };
  }

  async testSend(
    triggerKey: LineTriggerKey,
    body: string,
    adminUserId: string,
  ): Promise<{ sent: boolean }> {
    const meta = getMeta(triggerKey);
    const validation = validateBodyVariables(body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { testLineUserId: true },
    });
    if (!admin?.testLineUserId) {
      throw new BadRequestException({
        code: "TEST_LINE_USER_ID_MISSING",
        message: "테스트 발송에 사용할 LINE 사용자 ID가 등록되어 있지 않습니다",
      });
    }
    const rendered = renderTemplate(body, meta.variables, {} as never, { useSample: true });
    await this.line.pushToLineUserId(admin.testLineUserId, [{ type: "text", text: rendered }]);
    return { sent: true };
  }
}
