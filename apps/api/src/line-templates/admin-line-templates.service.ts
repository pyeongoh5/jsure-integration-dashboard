import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CampaignCategory,
  LineMessageTemplateDetailResponse,
  LineMessageTemplateListResponse,
  LineMessageTemplateResponse,
  LineTriggerKey,
  LineTriggerSubType,
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

  async list(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
  ): Promise<LineMessageTemplateListResponse> {
    const triggerKeys = listTriggersForCategory(category);
    const rows = await this.prisma.lineMessageTemplate.findMany({
      where: { category, subType },
      select: {
        triggerKey: true,
        enabled: true,
        updatedAt: true,
        updatedBy: { select: { name: true } },
      },
    });
    const byKey = new Map(rows.map((r) => [r.triggerKey, r]));
    return {
      category,
      subType,
      items: triggerKeys.map((k) => {
        const row = byKey.get(k);
        return {
          triggerKey: k,
          enabled: row?.enabled ?? false,
          updatedAt: row?.updatedAt?.toISOString() ?? null,
          updatedByName: row?.updatedBy?.name ?? null,
        };
      }),
    };
  }

  async detail(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
    triggerKey: LineTriggerKey,
  ): Promise<LineMessageTemplateDetailResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    const row = await this.prisma.lineMessageTemplate.findFirst({
      where: { category, subType, triggerKey },
      include: { updatedBy: { select: { name: true } } },
    });
    const template: LineMessageTemplateResponse = row
      ? {
          category: row.category,
          subType: row.subType,
          triggerKey: row.triggerKey,
          enabled: row.enabled,
          body: row.body,
          updatedAt: row.updatedAt.toISOString(),
          updatedById: row.updatedById,
          updatedByName: row.updatedBy?.name ?? null,
        }
      : {
          category,
          subType,
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
    subType: LineTriggerSubType | null,
    triggerKey: LineTriggerKey,
    updatedById: string,
    input: UpdateLineMessageTemplateRequest,
  ): Promise<LineMessageTemplateResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    if (input.enabled && input.body.trim().length === 0) {
      throw new BadRequestException("Body cannot be empty when enabled");
    }
    const validation = validateBodyVariables(input.body, meta.variables);
    if (!validation.ok) {
      throw new BadRequestException(
        `Unknown variables in body: ${validation.unknown.map((k) => `{{${k}}}`).join(", ")}`,
      );
    }
    const existing = await this.prisma.lineMessageTemplate.findFirst({
      where: { category, subType, triggerKey },
      select: { id: true },
    });
    const row = existing
      ? await this.prisma.lineMessageTemplate.update({
          where: { id: existing.id },
          data: {
            enabled: input.enabled,
            body: input.body,
            updatedById,
          },
          include: { updatedBy: { select: { name: true } } },
        })
      : await this.prisma.lineMessageTemplate.create({
          data: {
            category,
            subType,
            triggerKey,
            enabled: input.enabled,
            body: input.body,
            updatedById,
          },
          include: { updatedBy: { select: { name: true } } },
        });
    return {
      category: row.category,
      subType: row.subType,
      triggerKey: row.triggerKey,
      enabled: row.enabled,
      body: row.body,
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
      updatedByName: row.updatedBy?.name ?? null,
    };
  }

  async setEnabled(
    category: CampaignCategory,
    subType: LineTriggerSubType | null,
    triggerKey: LineTriggerKey,
    updatedById: string,
    enabled: boolean,
  ): Promise<LineMessageTemplateResponse> {
    const meta = getMeta(triggerKey);
    if (meta.category !== category) {
      throw new BadRequestException("Trigger does not belong to the given category");
    }
    const existing = await this.prisma.lineMessageTemplate.findFirst({
      where: { category, subType, triggerKey },
      select: { id: true, body: true },
    });
    if (!existing) {
      throw new NotFoundException("Template not found");
    }
    if (enabled && existing.body.trim().length === 0) {
      throw new BadRequestException("발송 활성화 상태에서 본문은 비어있을 수 없습니다");
    }
    const row = await this.prisma.lineMessageTemplate.update({
      where: { id: existing.id },
      data: { enabled, updatedById },
      include: { updatedBy: { select: { name: true } } },
    });
    return {
      category: row.category,
      subType: row.subType,
      triggerKey: row.triggerKey,
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
