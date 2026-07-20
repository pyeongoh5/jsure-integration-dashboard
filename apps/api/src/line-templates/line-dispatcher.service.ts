import { Injectable, Logger } from "@nestjs/common";
import type { LineTriggerKey } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LineMessagingService } from "../influencer-auth/line-messaging.service";
import { getMeta, type DispatchContext } from "./trigger-meta";
import { renderTemplate } from "./template-renderer";

@Injectable()
export class LineDispatcherService {
  private readonly logger = new Logger(LineDispatcherService.name);
  /** 인플루언서별 발송 직렬화 큐 — dispatch 호출 순서대로 push 되도록 보장. */
  private readonly queueTails = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly line: LineMessagingService,
  ) {}

  /**
   * 같은 인플루언서에게 연달아 발송되는 메시지(예: 인사이트 제출 완료 →
   * 무보수 캠페인 종료 안내)가 호출 순서 그대로 도착하도록, 인플루언서 단위로
   * 발송을 직렬화한다. 서로 다른 인플루언서 간에는 병렬 그대로.
   */
  dispatch(triggerKey: LineTriggerKey, context: DispatchContext): Promise<void> {
    const influencerId = context.application.influencerId;
    const tail = this.queueTails.get(influencerId) ?? Promise.resolve();
    // dispatchNow 는 내부에서 실패를 삼키지만, 만약을 대비해 앞 작업 실패가
    // 뒤 메시지를 막지 않도록 catch 후 이어붙인다.
    const next = tail
      .catch(() => undefined)
      .then(() => this.dispatchNow(triggerKey, context));
    this.queueTails.set(influencerId, next);
    void next.finally(() => {
      // 내가 마지막 작업이면 맵에서 제거해 무한 성장 방지.
      if (this.queueTails.get(influencerId) === next) {
        this.queueTails.delete(influencerId);
      }
    });
    return next;
  }

  private async dispatchNow(
    triggerKey: LineTriggerKey,
    context: DispatchContext,
  ): Promise<void> {
    const meta = getMeta(triggerKey);
    const category = meta.category;

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

    const renderedBody = renderTemplate(template.body, meta.variables, context);

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
