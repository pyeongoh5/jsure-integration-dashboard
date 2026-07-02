import { BadRequestException, Injectable } from "@nestjs/common";
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
      select: { triggerKey: true, enabled: true, updatedAt: true },
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
        }
      : {
          category,
          subType,
          triggerKey,
          enabled: false,
          body: "",
          updatedAt: null,
          updatedById: null,
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
        });
    return {
      category: row.category,
      subType: row.subType,
      triggerKey: row.triggerKey,
      enabled: row.enabled,
      body: row.body,
      updatedAt: row.updatedAt.toISOString(),
      updatedById: row.updatedById,
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
      throw new BadRequestException(
        "Register your LINE user ID in your admin profile before sending a test",
      );
    }
    const rendered = renderTemplate(body, meta.variables, {} as never, { useSample: true });
    await this.line.pushToLineUserId(admin.testLineUserId, [{ type: "text", text: rendered }]);
    return { sent: true };
  }
}
