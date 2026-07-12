import { Injectable, Logger } from "@nestjs/common";
import type { LineTriggerKey } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { getMeta, type DispatchContext } from "./trigger-meta";
import { renderTemplate } from "./template-renderer";

@Injectable()
export class LineDispatcherService {
  private readonly logger = new Logger(LineDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  async dispatch(triggerKey: LineTriggerKey, context: DispatchContext): Promise<void> {
    const meta = getMeta(triggerKey);
    const category = meta.category;

    let recruit = context.recruit ?? null;
    if (category === "FAKE_PURCHASE" && !recruit) {
      recruit = await this.prisma.campaignRecruit.findUnique({
        where: {
          campaignId_subType: {
            campaignId: context.application.campaignId,
            subType: context.application.subType,
          },
        },
      });
    }
    const enrichedContext: DispatchContext = { ...context, recruit };

    const toLineUserId = context.application.influencer.lineUserId ?? "";
    const applicationId = context.application.id;

    const template = await this.prisma.lineMessageTemplate.findUnique({
      where: { category_triggerKey: { category, triggerKey } },
    });

    if (!template) {
      await this.logDispatch({
        category,
        triggerKey,
        templateId: null,
        applicationId,
        toLineUserId,
        renderedBody: "",
        status: "SKIPPED_NO_TEMPLATE",
      });
      return;
    }

    if (!template.enabled) {
      await this.logDispatch({
        category,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody: "",
        status: "SKIPPED_DISABLED",
      });
      return;
    }

    const renderedBody = renderTemplate(template.body, meta.variables, enrichedContext);

    if (renderedBody.trim().length === 0) {
      await this.logDispatch({
        category,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody: "",
        status: "SKIPPED_DISABLED",
      });
      return;
    }

    try {
      await this.line.pushText(context.application.influencerId, renderedBody);
      await this.logDispatch({
        category,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody,
        status: "SUCCESS",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Dispatch failed: ${triggerKey}`, err as Error);
      await this.logDispatch({
        category,
        triggerKey,
        templateId: template.id,
        applicationId,
        toLineUserId,
        renderedBody,
        status: "FAILED",
        errorMessage,
      });
    }
  }

  private async logDispatch(data: {
    category: "SNS" | "FAKE_PURCHASE" | "SIMPLE_REVIEW";
    triggerKey: LineTriggerKey;
    templateId: string | null;
    applicationId: string | null;
    toLineUserId: string;
    renderedBody: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED_DISABLED" | "SKIPPED_NO_TEMPLATE";
    errorMessage?: string;
  }): Promise<void> {
    try {
      await this.prisma.lineDispatchLog.create({ data });
    } catch (err) {
      this.logger.error("Failed to write dispatch log", err as Error);
    }
  }
}
