import { Injectable, Logger } from "@nestjs/common";
import type { AdminActivityAction, AdminActivityOrigin } from "@jsure/shared";
import { PrismaService } from "../prisma/prisma.service";

/** 행위 시점의 어드민 스냅샷. AuthenticatedUser 를 그대로 넘길 수 있다. */
export type AuditActor = { id: string; name: string | null };

type AuditMetadataValue =
  | string
  | number
  | boolean
  | null
  | AuditMetadataValue[];

/** JSON 직렬화 가능한 부가 정보. PII(계좌·주소·메모 본문)는 넣지 않는다. */
export type AuditMetadata = Record<string, AuditMetadataValue>;

export type AuditEntry = {
  action: AdminActivityAction;
  /** 기본 ADMIN. 연쇄 액션은 CASCADE, 어드민 미개입은 SYSTEM. */
  origin?: AdminActivityOrigin;
  /** SYSTEM 이면 생략하거나 null. */
  actor?: AuditActor | null;
  applicationId?: string;
  campaignId?: string;
  settlementId?: string;
  influencerId?: string;
  metadata?: AuditMetadata;
};

function toRow(entry: AuditEntry) {
  return {
    action: entry.action,
    origin: entry.origin ?? "ADMIN",
    actorId: entry.actor?.id ?? null,
    actorName: entry.actor?.name ?? null,
    applicationId: entry.applicationId ?? null,
    campaignId: entry.campaignId ?? null,
    settlementId: entry.settlementId ?? null,
    influencerId: entry.influencerId ?? null,
    // undefined 를 넘기면 Prisma 가 컬럼을 건드리지 않아 NULL 로 남는다.
    metadata: entry.metadata,
  };
}

/**
 * 어드민 도메인 액션의 감사 로그 기록.
 *
 * best-effort 다 — 기록 실패가 도메인 액션을 실패시키지 않는다. 현재 서비스
 * 대부분이 $transaction 을 쓰지 않아 mandatory 로 가려면 대규모 트랜잭션
 * 리팩토링이 동반되고 회귀 위험이 크다. 금전 액션의 in-transaction 승격은
 * 후속 과제.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.adminActivityLog.create({ data: toRow(entry) });
    } catch (error) {
      this.logger.error(`감사 로그 기록 실패: ${entry.action}`, error);
    }
  }

  /** 일괄 액션용 (정산 일괄 완료 등). createMany 1회. */
  async recordMany(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;
    try {
      await this.prisma.adminActivityLog.createMany({
        data: entries.map(toRow),
      });
    } catch (error) {
      const actions = entries.map((entry) => entry.action).join(",");
      this.logger.error(`감사 로그 일괄 기록 실패: ${actions}`, error);
    }
  }
}
