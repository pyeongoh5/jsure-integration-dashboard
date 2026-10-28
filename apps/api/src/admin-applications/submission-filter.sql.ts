import { Prisma } from "@prisma/client";
import {
  APPLICANT_MEDIA_FILTER_TARGET,
  DRAFT_VIEW_STATUS_RULES,
  type DraftViewStatusRule,
  type SubmissionFilter,
} from "@jsure/shared";

/**
 * 제출물 검토 목록이 쓰는 FROM 절. 별칭: a=응모, c=캠페인.
 * 인플루언서는 필터 조건이 없어 조인하지 않는다(상세는 include 가 따로 읽는다).
 */
export const SUBMISSION_FROM_SQL = Prisma.sql`
  FROM campaign_applications a
  JOIN campaigns c ON c.id = a."campaignId"
`;

/** 모든 게시물의 인사이트가 제출됐는가 — 하나라도 미제출이면 false. */
const ALL_INSIGHTS_SUBMITTED_SQL = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM submitted_posts p
  WHERE p."applicationId" = a.id AND p."insightSubmittedAt" IS NULL
)`;

const HAS_SETTLEMENT_SQL = Prisma.sql`EXISTS (
  SELECT 1 FROM settlements s WHERE s."applicationId" = a.id
)`;

/** 화면 노출 상태 규칙 하나를 SQL 조건으로. 규칙 표(shared)가 유일한 출처다. */
function viewStatusRuleSql(rule: DraftViewStatusRule): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`a."submissionReviewStatus"::text = ${rule.reviewStatus}`,
  ];
  if (rule.insightSubmitted !== null) {
    parts.push(
      rule.insightSubmitted
        ? ALL_INSIGHTS_SUBMITTED_SQL
        : Prisma.sql`NOT ${ALL_INSIGHTS_SUBMITTED_SQL}`,
    );
  }
  if (rule.hasSettlement !== null) {
    parts.push(
      rule.hasSettlement
        ? HAS_SETTLEMENT_SQL
        : Prisma.sql`NOT ${HAS_SETTLEMENT_SQL}`,
    );
  }
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

/**
 * 필터 전체를 WHERE 조건으로.
 *
 * 상태 필터가 비어 있어도 "검토 화면에 노출되는 건" 조건은 항상 붙는다 —
 * 정산 흐름에 들어간 건은 규칙 표의 어느 규칙에도 맞지 않아 자동으로 빠진다.
 */
export function buildSubmissionWhereSql(filter: SubmissionFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    // 제출물이 있는 응모만. 강제 취소 건은 제출물이 남아 있어도 검수 대상이 아니다.
    Prisma.sql`EXISTS (SELECT 1 FROM submitted_posts p WHERE p."applicationId" = a.id)`,
    Prisma.sql`a."status"::text <> 'CANCELLED'`,
  ];

  const rules =
    filter.viewStatuses.length > 0
      ? DRAFT_VIEW_STATUS_RULES.filter((rule) =>
          filter.viewStatuses.includes(rule.viewStatus),
        )
      : DRAFT_VIEW_STATUS_RULES;
  conditions.push(
    Prisma.sql`(${Prisma.join(rules.map(viewStatusRuleSql), " OR ")})`,
  );

  if (filter.campaignId) {
    conditions.push(Prisma.sql`a."campaignId" = ${filter.campaignId}`);
  }

  if (filter.category) {
    conditions.push(Prisma.sql`c."category"::text = ${filter.category}`);
  }

  if (filter.mediaKeys.length > 0) {
    const mediaConditions = filter.mediaKeys.map((key) => {
      const target = APPLICANT_MEDIA_FILTER_TARGET[key];
      if (target.option) {
        return Prisma.sql`EXISTS (
          SELECT 1 FROM campaign_application_options o
          WHERE o."applicationId" = a.id
            AND o."subType"::text = ${target.subType}
            AND o."option" = ${target.option}
        )`;
      }
      return Prisma.sql`${target.subType}::text = ANY(a."subTypes"::text[])`;
    });
    conditions.push(Prisma.sql`(${Prisma.join(mediaConditions, " OR ")})`);
  }

  return Prisma.join(conditions, " AND ");
}

/**
 * reviewSubmittedAt 내림차순(NULL 은 뒤) 커서 조건.
 *
 * NULLS LAST 정렬에서는 튜플 비교가 그대로 통하지 않는다 — NULL 과의 비교가
 * NULL 이 되어 행이 통째로 빠진다. 그래서 "커서가 NULL 인가"로 나눠 쓴다.
 * 커서 id 가 사라졌으면 결과가 비는 쪽이 안전하다.
 */
export function submissionCursorSql(cursor: string): Prisma.Sql {
  return Prisma.sql`(
    SELECT CASE
      WHEN x."reviewSubmittedAt" IS NULL
        THEN a."reviewSubmittedAt" IS NULL AND a.id < x.id
      ELSE a."reviewSubmittedAt" IS NULL
        OR (a."reviewSubmittedAt", a.id) < (x."reviewSubmittedAt", x.id)
    END
    FROM campaign_applications x WHERE x.id = ${cursor}
  )`;
}
