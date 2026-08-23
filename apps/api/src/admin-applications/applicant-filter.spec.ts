import {
  APPLICANT_VIEW_STATUS_RULES,
  ApplicationStatusSchema,
  CampaignCategorySchema,
  deriveApplicantViewStatus,
  parseApplicantFilterParams,
  type ApplicantViewStatus,
  type ApplicationStatus,
  type CampaignCategory,
} from "@jsure/shared";
import { buildApplicantWhereSql } from "./applicant-filter.sql";

const ALL_STATUSES = ApplicationStatusSchema.options;
const ALL_CATEGORIES = CampaignCategorySchema.options;
const RECEIVED_VALUES = [null, new Date("2026-01-01T00:00:00.000Z")];

/**
 * 서버 필터 도입 전 클라이언트가 쓰던 판정 로직. 규칙 표가 이 동작을 그대로
 * 재현하는지 확인하는 기준값으로만 쓴다.
 */
function legacyDeriveStatus(input: {
  status: ApplicationStatus;
  category: CampaignCategory;
  receivedAt: Date | null;
}): ApplicantViewStatus | null {
  if (input.status === "CANCELLED") return null;
  if (input.status === "COMPLETED") return null;
  if (input.status === "REVIEW_SUBMITTED") return null;
  if (input.status === "APPLIED") return "APPLIED";
  if (input.status === "REJECTED") return "REJECTED";

  if (input.category === "FAKE_PURCHASE") {
    if (input.status === "APPROVED") return "AWAITING_ORDER";
    if (input.status === "ORDER_SUBMITTED") return "AWAITING_REVIEW";
    return null;
  }

  if (input.receivedAt) return "POST_DUE";
  if (input.status === "DELIVERED") return "DELIVERED";
  if (input.status === "SHIPPED") return "SHIPPING";
  if (input.status === "APPROVED") return "PRE_SHIP";
  return null;
}

function everyCombination(): {
  status: ApplicationStatus;
  category: CampaignCategory;
  receivedAt: Date | null;
}[] {
  return ALL_STATUSES.flatMap((status) =>
    ALL_CATEGORIES.flatMap((category) =>
      RECEIVED_VALUES.map((receivedAt) => ({ status, category, receivedAt })),
    ),
  );
}

describe("응모자 화면 상태 규칙", () => {
  it("모든 상태 조합에서 기존 클라이언트 판정과 같은 결과를 낸다", () => {
    for (const combination of everyCombination()) {
      expect({
        ...combination,
        viewStatus: deriveApplicantViewStatus(combination),
      }).toEqual({
        ...combination,
        viewStatus: legacyDeriveStatus(combination),
      });
    }
  });

  it("규칙끼리 겹치지 않는다 — 한 응모는 최대 하나의 화면 상태를 갖는다", () => {
    for (const combination of everyCombination()) {
      const matched = APPLICANT_VIEW_STATUS_RULES.filter(
        (rule) =>
          deriveApplicantViewStatus({
            ...combination,
            status: combination.status,
          }) === rule.viewStatus,
      );
      expect(matched.length).toBeLessThanOrEqual(1);
    }
  });

  it("화면 상태 8종이 모두 규칙 표에 있다", () => {
    const covered = new Set(
      APPLICANT_VIEW_STATUS_RULES.map((rule) => rule.viewStatus),
    );
    expect([...covered].sort()).toEqual(
      [
        "APPLIED",
        "AWAITING_ORDER",
        "AWAITING_REVIEW",
        "DELIVERED",
        "POST_DUE",
        "PRE_SHIP",
        "REJECTED",
        "SHIPPING",
      ].sort(),
    );
  });
});

describe("buildApplicantWhereSql", () => {
  const emptyFilter = parseApplicantFilterParams({});

  it("상태 필터가 없어도 숨김 상태(정산완료·취소·검토제출)는 걸러진다", () => {
    const sql = buildApplicantWhereSql(emptyFilter);
    // 규칙 표에 없는 상태는 어떤 조건에도 나타나지 않는다.
    expect(sql.values).not.toContain("COMPLETED");
    expect(sql.values).not.toContain("CANCELLED");
    expect(sql.values).not.toContain("REVIEW_SUBMITTED");
    expect(sql.values).toContain("APPLIED");
  });

  it("선택한 화면 상태의 규칙만 남긴다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ status: "PRE_SHIP" }),
    );
    expect(sql.values).toContain("APPROVED");
    expect(sql.values).not.toContain("APPLIED");
    expect(sql.sql).toContain(`a."receivedAt" IS NULL`);
  });

  it("인스타그램 피드/릴스는 응모 옵션으로 판정한다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ media: "ig-reels" }),
    );
    expect(sql.sql).toContain("campaign_application_options");
    expect(sql.values).toContain("REELS");
  });

  it("옵션이 없는 서브타입은 응모 서브타입 배열로 판정한다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ media: "tt" }),
    );
    expect(sql.sql).toContain(`ANY(a."subTypes"::text[])`);
    expect(sql.values).toContain("TIKTOK");
  });

  it("최소 팔로워는 응모한 서브타입 계정의 합계로 비교한다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ minFollowers: "1000" }),
    );
    expect(sql.sql).toContain(`SUM(s."followerCount")`);
    expect(sql.values).toContain(1000);
  });

  it("검색어는 이름·인플루언서 id·SNS 핸들을 함께 본다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ q: "hana" }),
    );
    expect(sql.sql).toContain(`i."name" ILIKE`);
    expect(sql.sql).toContain(`s."handle" ILIKE`);
    expect(sql.values).toContain("%hana%");
  });

  it("검색어의 LIKE 메타문자는 이스케이프한다", () => {
    const sql = buildApplicantWhereSql(
      parseApplicantFilterParams({ q: "100%_off" }),
    );
    expect(sql.values).toContain("%100\\%\\_off%");
  });

  it("알 수 없는 필터 값은 무시한다", () => {
    const filter = parseApplicantFilterParams({
      media: "myspace",
      status: "SOMETHING",
      category: "NOPE",
      minFollowers: "-5",
    });
    expect(filter.mediaKeys).toEqual([]);
    expect(filter.viewStatuses).toEqual([]);
    expect(filter.category).toBeNull();
    expect(filter.minFollowers).toBeNull();
  });
});
