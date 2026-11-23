import { parseSubmissionFilterParams } from "@jsure/shared";
import { buildSubmissionWhereSql } from "./submission-filter.sql";

describe("buildSubmissionWhereSql — 검색어", () => {
  it("이름·인플루언서 id·SNS 핸들을 함께 본다", () => {
    const sql = buildSubmissionWhereSql(
      parseSubmissionFilterParams({ q: "hana" }),
    );
    expect(sql.sql).toContain(`i."name" ILIKE`);
    expect(sql.sql).toContain(`s."handle" ILIKE`);
    expect(sql.values).toContain("%hana%");
  });

  it("LIKE 메타문자는 이스케이프한다", () => {
    const sql = buildSubmissionWhereSql(
      parseSubmissionFilterParams({ q: "100%_off" }),
    );
    expect(sql.values).toContain("%100\\%\\_off%");
  });

  it("검색어가 없으면 인플루언서 조건을 걸지 않는다", () => {
    const sql = buildSubmissionWhereSql(parseSubmissionFilterParams({}));
    expect(sql.sql).not.toContain(`i."name" ILIKE`);
  });
});
