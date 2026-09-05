import {
  ADMIN_INSIGHT_METRIC_KEYS,
  type AdminInsightMetricKey,
  type AdminUpdateInsightRequest,
} from "@jsure/shared";

/** 인사이트 지표 키 → SubmittedPost 컬럼명. */
const METRIC_COLUMN: Record<AdminInsightMetricKey, InsightColumn> = {
  likes: "insightLikes",
  comments: "insightComments",
  shares: "insightShares",
  reposts: "insightReposts",
  saves: "insightSaves",
  views: "insightViews",
  reach: "insightReach",
};

type InsightColumn =
  | "insightLikes"
  | "insightComments"
  | "insightShares"
  | "insightReposts"
  | "insightSaves"
  | "insightViews"
  | "insightReach";

/** 보정 전 값 — 변경 이력 비교와 no-op 판정에 쓴다. */
export type InsightSnapshot = { url: string | null } & Record<
  InsightColumn,
  number | null
>;

export type InsightUpdateData = Partial<InsightSnapshot>;

/**
 * 요청에서 "실제로 값이 달라지는 필드"만 골라 Prisma update 데이터로 만든다.
 * 생략된 필드(undefined)와 기존과 같은 값은 제외 — 변경 이력이 빈 수정으로
 * 오염되지 않도록.
 */
export function buildInsightUpdateData(
  before: InsightSnapshot,
  body: AdminUpdateInsightRequest,
): InsightUpdateData {
  const data: InsightUpdateData = {};
  if (body.url !== undefined && body.url !== before.url) {
    data.url = body.url;
  }
  for (const key of ADMIN_INSIGHT_METRIC_KEYS) {
    const next = body[key];
    const column = METRIC_COLUMN[key];
    if (next !== undefined && next !== before[column]) {
      data[column] = next;
    }
  }
  return data;
}

/** 감사 로그 metadata 용 사람이 읽는 변경 목록. */
export function buildInsightChanges(
  before: InsightSnapshot,
  data: InsightUpdateData,
): string[] {
  const changes: string[] = [];
  if (data.url !== undefined) {
    changes.push(`url: ${before.url ?? "없음"} → ${data.url ?? "없음"}`);
  }
  for (const key of ADMIN_INSIGHT_METRIC_KEYS) {
    const column = METRIC_COLUMN[key];
    const next = data[column];
    if (next !== undefined) {
      changes.push(`${key}: ${before[column] ?? "없음"} → ${next ?? "없음"}`);
    }
  }
  return changes;
}
