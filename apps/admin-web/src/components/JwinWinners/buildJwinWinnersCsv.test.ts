import { describe, expect, it } from "vitest";
import type { AdminWinnerExportRow } from "@/domains/jwin";

// vitest 환경이 node라 localStorage 가 없다. 저장된 언어가 없을 때와 같은 상태(ko)로 둔다.
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
} as Storage;

const { buildJwinWinnersCsv, jwinWinnersCsvFilename } = await import("./buildJwinWinnersCsv");

const physicalRow: AdminWinnerExportRow = {
  id: "w1",
  dateJst: "2026-09-05",
  xUsername: "someone",
  prizeName: "토스터",
  prizeType: "PHYSICAL",
  verification: "PASSED",
  fulfillment: "READY",
  hasShipping: true,
  dmSentAt: null,
  dmError: null,
  shipping: {
    postalCode: "1500001",
    prefecture: "東京都",
    address1: "渋谷区1-1",
    address2: "301号",
    fullName: "山田太郎",
    phone: "09012345678",
  },
};

const codeRow: AdminWinnerExportRow = {
  id: "w2",
  dateJst: "2026-09-05",
  xUsername: null,
  prizeName: "기프트카드",
  prizeType: "CODE",
  verification: "PENDING",
  fulfillment: "DM_SENT",
  hasShipping: false,
  dmSentAt: "2026-09-05T01:00:00.000Z",
  dmError: null,
  shipping: null,
};

const HEADER_COLUMNS = 12;

describe("buildJwinWinnersCsv", () => {
  it("행이 없어도 헤더는 남는다", () => {
    const csv = buildJwinWinnersCsv({ rows: [] });
    expect(csv.split("\r\n")).toHaveLength(1);
    expect(csv.split(",")).toHaveLength(HEADER_COLUMNS);
  });

  it("배송지가 있는 행은 주소 칸이 채워진다", () => {
    const [, row = ""] = buildJwinWinnersCsv({ rows: [physicalRow] }).split("\r\n");
    expect(row).toContain("@someone");
    expect(row).toContain("1500001");
    expect(row).toContain("山田太郎");
  });

  it("배송지가 없으면 주소 칸을 비우되 열 수는 유지한다", () => {
    const [, row = ""] = buildJwinWinnersCsv({ rows: [codeRow] }).split("\r\n");
    expect(row.split(",")).toHaveLength(HEADER_COLUMNS);
    expect(row.endsWith(",,,,,,")).toBe(true);
  });

  it("쉼표·따옴표가 든 값은 따옴표로 감싸 열이 밀리지 않게 한다", () => {
    const risky: AdminWinnerExportRow = {
      ...physicalRow,
      prizeName: '토스터, "한정판"',
    };
    const [, row = ""] = buildJwinWinnersCsv({ rows: [risky] }).split("\r\n");
    expect(row).toContain('"토스터, ""한정판"""');
  });

  it("여러 행은 CRLF로 나뉜다", () => {
    const csv = buildJwinWinnersCsv({ rows: [physicalRow, codeRow] });
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("jwinWinnersCsvFilename", () => {
  it("파일명에 못 쓰는 문자를 치환한다", () => {
    expect(jwinWinnersCsvFilename("brand/캠페인 2026", "2026-09-05")).toBe(
      "jwin-winners-brand_캠페인_2026-2026-09-05.csv",
    );
  });
});
