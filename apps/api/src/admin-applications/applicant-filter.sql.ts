import { Prisma } from "@prisma/client";
import {
  APPLICANT_MEDIA_FILTER_TARGET,
  APPLICANT_VIEW_STATUS_RULES,
  type ApplicantFilter,
  type ApplicantViewStatusRule,
} from "@jsure/shared";

/**
 * 응모자 관리 목록/CSV 가 공유하는 FROM 절.
 * 별칭: a=응모, c=캠페인, i=인플루언서.
 */
export const APPLICANT_FROM_SQL = Prisma.sql`
  FROM campaign_applications a
  JOIN campaigns c ON c.id = a."campaignId"
  JOIN influencers i ON i.id = a."influencerId"
`;

/** 화면 노출 상태 규칙 하나를 SQL 조건으로. 규칙 표(shared)가 유일한 출처다. */
function viewStatusRuleSql(rule: ApplicantViewStatusRule): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`a."status"::text IN (${Prisma.join(
      rule.statuses.map((status) => Prisma.sql`${status}`),
    )})`,
  ];
  if (rule.category === "FAKE_PURCHASE") {
    parts.push(Prisma.sql`c."category"::text = 'FAKE_PURCHASE'`);
  }
  if (rule.category === "NOT_FAKE_PURCHASE") {
    parts.push(Prisma.sql`c."category"::text <> 'FAKE_PURCHASE'`);
  }
  if (rule.received === "RECEIVED") {
    parts.push(Prisma.sql`a."receivedAt" IS NOT NULL`);
  }
  if (rule.received === "NOT_RECEIVED") {
    parts.push(Prisma.sql`a."receivedAt" IS NULL`);
  }
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

/** 응모한 서브타입 계정의 팔로워 합계. */
export const applicantFollowersSql = Prisma.sql`COALESCE((
  SELECT SUM(s."followerCount")
  FROM influencer_sns_accounts s
  WHERE s."influencerId" = a."influencerId"
    AND s."snsType"::text = ANY(a."subTypes"::text[])
), 0)`;

/** LIKE 메타문자를 이스케이프. 기본 이스케이프 문자(\)를 그대로 쓴다. */
function likePattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * 필터 전체를 WHERE 조건으로 변환.
 * 상태 필터가 비어 있어도 "화면에 노출되는 응모" 조건은 항상 붙는다 —
 * 검토 제출·정산 완료·취소 건은 응모자 관리에 나오지 않기 때문.
 */
export function buildApplicantWhereSql(filter: ApplicantFilter): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  const rules =
    filter.viewStatuses.length > 0
      ? APPLICANT_VIEW_STATUS_RULES.filter((rule) =>
          filter.viewStatuses.includes(rule.viewStatus),
        )
      : APPLICANT_VIEW_STATUS_RULES;
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

  if (filter.minFollowers !== null) {
    // 팔로워 = 응모한 서브타입 계정의 합계. 화면 팔로워 컬럼과 같은 기준.
    conditions.push(Prisma.sql`${applicantFollowersSql} >= ${filter.minFollowers}`);
  }

  const query = filter.query.trim();
  if (query) {
    const pattern = likePattern(query);
    conditions.push(Prisma.sql`(
      i."name" ILIKE ${pattern}
      OR i.id ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM influencer_sns_accounts s
        WHERE s."influencerId" = i.id AND s."handle" ILIKE ${pattern}
      )
    )`);
  }

  return Prisma.join(conditions, " AND ");
}

/** appliedAt 내림차순 커서 조건. 커서 id 가 사라졌으면 결과가 비는 쪽이 안전. */
export function applicantCursorSql(cursor: string): Prisma.Sql {
  return Prisma.sql`(a."appliedAt", a.id) < (
    SELECT x."appliedAt", x.id FROM campaign_applications x WHERE x.id = ${cursor}
  )`;
}
