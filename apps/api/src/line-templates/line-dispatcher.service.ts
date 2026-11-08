import { Injectable, Logger } from "@nestjs/common";
import type {
  CommonLineTriggerKey,
  LineTemplateCategory,
  LineTriggerKey,
} from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  LineMessagingService,
  type LinePushResult,
} from "../influencer-auth/line-messaging.service";
import {
  getCommonMeta,
  getMeta,
  type CommonDispatchContext,
  type DispatchContext,
} from "./trigger-meta";
import { renderTemplate } from "./template-renderer";

type DispatchStatus =
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED_DISABLED"
  | "SKIPPED_NO_TEMPLATE";

/** 템플릿 조회부터 발송까지 두 경로가 공유하는 식별 정보. */
type DispatchTarget = {
  category: LineTemplateCategory;
  triggerKey: LineTriggerKey;
  /** 공통 트리거는 응모가 없어 null. */
  applicationId: string | null;
  influencerId: string;
  toLineUserId: string;
};

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
    return this.enqueue(context.application.influencerId, () =>
      this.dispatchNow(triggerKey, context),
    );
  }

  /**
   * 캠페인 응모 없이 인플루언서에게 직접 보내는 알림(탈퇴 승인·반려).
   * 캠페인 발송과 같은 큐를 쓰므로 순서 보장도 동일하다.
   */
  dispatchCommon(
    triggerKey: CommonLineTriggerKey,
    context: CommonDispatchContext,
  ): Promise<void> {
    return this.enqueue(context.influencer.id, () =>
      this.dispatchCommonNow(triggerKey, context),
    );
  }

  private enqueue(influencerId: string, task: () => Promise<void>): Promise<void> {
    const tail = this.queueTails.get(influencerId) ?? Promise.resolve();
    // task 는 내부에서 실패를 삼키지만, 만약을 대비해 앞 작업 실패가
    // 뒤 메시지를 막지 않도록 catch 후 이어붙인다.
    const next = tail.catch(() => undefined).then(task);
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
    if (!meta) {
      this.logger.error(
        `캠페인 트리거 메타를 찾을 수 없습니다 — 공통 트리거는 dispatchCommon 을 쓰세요: ${triggerKey}`,
      );
      return;
    }
    const target: DispatchTarget = {
      category: meta.category,
      triggerKey,
      applicationId: context.application.id,
      influencerId: context.application.influencerId,
      toLineUserId: context.application.influencer.lineUserId ?? "",
    };
    const template = await this.resolveTemplate(target);
    if (!template) return;

    const renderedBody = renderTemplate(template.body, meta.variables, context);
    // 캠페인 발송은 기존대로 인플루언서를 다시 읽어 최신 lineUserId 를 쓴다.
    await this.renderAndSend(target, template, renderedBody, () =>
      this.line.pushText(target.influencerId, renderedBody),
    );
  }

  private async dispatchCommonNow(
    triggerKey: CommonLineTriggerKey,
    context: CommonDispatchContext,
  ): Promise<void> {
    const meta = getCommonMeta(triggerKey);
    const target: DispatchTarget = {
      category: meta.category,
      triggerKey,
      applicationId: null,
      influencerId: context.influencer.id,
      toLineUserId: context.influencer.lineUserId ?? "",
    };
    const template = await this.resolveTemplate(target);
    if (!template) return;

    const renderedBody = renderTemplate(template.body, meta.variables, context);
    // 공통 알림은 호출부가 넘긴 lineUserId 로 바로 보낸다. 탈퇴 승인처럼 발송
    // 직후 그 값이 지워지는 흐름이 있어, 여기서 DB 를 다시 읽으면 놓친다.
    await this.renderAndSend(target, template, renderedBody, () =>
      target.toLineUserId === ""
        ? Promise.resolve({
            ok: false as const,
            skipped: true as const,
            reason: "LINE 연동이 없는 인플루언서",
          })
        : this.line.pushToLineUserId(target.toLineUserId, [
            { type: "text", text: renderedBody },
          ]),
    );
  }

  /** 템플릿이 없거나 꺼져 있으면 스킵 로그만 남기고 null. */
  private async resolveTemplate(
    target: DispatchTarget,
  ): Promise<{ id: string; body: string } | null> {
    const template = await this.prisma.lineMessageTemplate.findUnique({
      where: {
        category_triggerKey: {
          category: target.category,
          triggerKey: target.triggerKey,
        },
      },
    });

    if (!template) {
      await this.logDispatch({
        ...target,
        templateId: null,
        renderedBody: "",
        status: "SKIPPED_NO_TEMPLATE",
      });
      return null;
    }

    if (!template.enabled) {
      await this.logDispatch({
        ...target,
        templateId: template.id,
        renderedBody: "",
        status: "SKIPPED_DISABLED",
      });
      return null;
    }

    return { id: template.id, body: template.body };
  }

  private async renderAndSend(
    target: DispatchTarget,
    template: { id: string },
    renderedBody: string,
    push: () => Promise<LinePushResult>,
  ): Promise<void> {
    if (renderedBody.trim().length === 0) {
      await this.logDispatch({
        ...target,
        templateId: template.id,
        renderedBody: "",
        status: "SKIPPED_DISABLED",
      });
      return;
    }

    try {
      const result = await push();
      // LINE 이 4xx/5xx 를 주거나 대상이 없어도 예외가 아니므로, 결과를 그대로
      // 상태에 반영해야 로그의 SUCCESS 가 실제 도달을 의미한다.
      await this.logDispatch({
        ...target,
        templateId: template.id,
        renderedBody,
        status: result.ok
          ? "SUCCESS"
          : result.skipped
            ? "SKIPPED_DISABLED"
            : "FAILED",
        errorMessage: result.ok ? undefined : result.reason,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Dispatch failed: ${target.triggerKey}`, err as Error);
      await this.logDispatch({
        ...target,
        templateId: template.id,
        renderedBody,
        status: "FAILED",
        errorMessage,
      });
    }
  }

  private async logDispatch(
    data: DispatchTarget & {
      templateId: string | null;
      renderedBody: string;
      status: DispatchStatus;
      errorMessage?: string;
    },
  ): Promise<void> {
    const { influencerId: _influencerId, ...row } = data;
    try {
      await this.prisma.lineDispatchLog.create({ data: row });
    } catch (err) {
      this.logger.error("Failed to write dispatch log", err as Error);
    }
  }
}
