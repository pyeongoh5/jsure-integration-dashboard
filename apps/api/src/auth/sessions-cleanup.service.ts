import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SessionsService } from "./sessions.service";

@Injectable()
export class SessionsCleanupService {
  private readonly log = new Logger(SessionsCleanupService.name);

  constructor(private readonly sessions: SessionsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: "Asia/Seoul" })
  async run() {
    const { expired, revoked } = await this.sessions.cleanupExpired();
    if (expired || revoked) {
      this.log.log(
        `Pruned ${expired} expired and ${revoked} long-revoked sessions`,
      );
    }
  }
}
