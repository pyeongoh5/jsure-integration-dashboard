import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * 메일 발송 (Resend REST API).
 *
 * SDK 대신 fetch 로 직접 부른다 — 엔드포인트가 하나뿐이라 의존성을 늘릴 이유가 없다.
 *
 * RESEND_API_KEY 가 없으면 발송하지 않고 **본문을 로그로 남긴다**. 로컬에서 메일 계정
 * 없이도 흐름을 확인할 수 있어야 하고, 운영에서 키가 비면 error 로그로 드러나야 한다.
 *
 * 발신 도메인(MAIL_FROM 의 도메인)은 Resend 에서 DNS 인증이 끝나 있어야 한다.
 * 미인증 도메인으로 보내면 Resend 가 403 으로 거절한다.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  /** 발송 성공 여부. 실패해도 예외를 던지지 않는다 — 호출부가 흐름을 이어가야 한다. */
  async send(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<boolean> {
    const apiKey = this.config.get<string>("RESEND_API_KEY");
    const from = this.config.get<string>("MAIL_FROM");

    if (!apiKey || !from) {
      this.logger.warn(
        `메일 설정(RESEND_API_KEY·MAIL_FROM)이 없어 발송을 건너뜁니다 — to=${input.to}\n${input.text}`,
      );
      return false;
    }

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        }),
      });
      if (!res.ok) {
        this.logger.error(
          `메일 발송 실패 (${res.status}) to=${input.to}: ${await res.text()}`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`메일 발송 중 오류 to=${input.to}`, error);
      return false;
    }
  }
}
