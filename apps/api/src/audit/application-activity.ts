import {
  AdminActivityActionSchema,
  AdminActivityOriginSchema,
  type AdminActivityLog,
} from "@jsure/shared";

/** Prisma 가 돌려주는 로그 row 중 응답에 쓰는 필드만. */
export type ActivityLogRow = {
  id: string;
  action: string;
  origin: string;
  actorId: string | null;
  actorName: string | null;
  metadata: unknown;
  createdAt: Date;
};

function toMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  if (Array.isArray(value)) return null;
  return { ...value };
}

/**
 * 로그 row → 응답 모양. action/origin 은 String 컬럼이므로 여기서 zod 로
 * 파싱해 유니온 타입을 확정한다 — 코드에서 액션을 제거하면 옛 row 를 읽을 때
 * 여기서 터지므로, 액션은 지우지 않고 라벨만 정리하는 것이 원칙이다.
 */
export function toActivityLog(row: ActivityLogRow): AdminActivityLog {
  return {
    id: row.id,
    action: AdminActivityActionSchema.parse(row.action),
    origin: AdminActivityOriginSchema.parse(row.origin),
    actor: row.actorId ? { id: row.actorId, name: row.actorName } : null,
    metadata: toMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}
