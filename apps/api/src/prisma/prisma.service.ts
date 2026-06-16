import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

// 쿼리 로그는 진단용. production 에서는 매 쿼리마다 event emit + stdout 부담을 피하기 위해
// 비활성화한다. 임계값(ms) 이상만 보고 노이즈를 줄임.
const QUERY_LOG_ENABLED = process.env.NODE_ENV !== "production";
const QUERY_LOG_THRESHOLD_MS = 50;

@Injectable()
export class PrismaService
  extends PrismaClient<{ log: Prisma.LogDefinition[] }>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("PrismaQuery");

  constructor() {
    super({
      log: QUERY_LOG_ENABLED
        ? [
            { level: "query", emit: "event" },
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ]
        : [
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ],
    });
    if (QUERY_LOG_ENABLED) {
      this.$on("query" as never, (event: Prisma.QueryEvent) => {
        if (event.duration >= QUERY_LOG_THRESHOLD_MS) {
          this.logger.log(`${event.duration}ms ${event.query}`);
        }
      });
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
