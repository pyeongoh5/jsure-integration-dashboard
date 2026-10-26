import { describe, expect, it } from "vitest";
import type { ApprovedApplicantExportRow } from "@jsure/shared";
import { filterRowsByCapacityChip, type CapacityChip } from "./buildCapacityChips";

function row(
  applicationId: string,
  channels: ApprovedApplicantExportRow["channels"],
): ApprovedApplicantExportRow {
  return {
    applicationId,
    influencerId: `influencer-${applicationId}`,
    name: applicationId,
    nameKana: null,
    channels,
    productOptions: [],
    phone: "",
    postalCode: "",
    address: "",
    appliedAt: "2026-10-12T00:00:00.000Z",
  };
}

function channel(option: string | null) {
  return {
    subType: "INSTAGRAM" as const,
    option,
    snsHandle: option ?? "handle",
    profileUrl: "",
  };
}

function chip(match: CapacityChip["match"]): CapacityChip {
  return { key: "chip", label: "chip", approved: 0, total: 0, match };
}

const rows = [
  row("feedOnly", [channel("FEED")]),
  row("reelsOnly", [channel("REELS")]),
  row("both", [channel("FEED"), channel("REELS")]),
];

describe("filterRowsByCapacityChip", () => {
  it("전체 칩이면 그대로 돌려준다", () => {
    expect(filterRowsByCapacityChip(rows, chip(null))).toEqual(rows);
  });

  it("옵션 칩이면 해당 옵션 응모자만 남긴다", () => {
    const filtered = filterRowsByCapacityChip(
      rows,
      chip({ subType: "INSTAGRAM", option: "FEED" }),
    );
    expect(filtered.map((item) => item.applicationId)).toEqual([
      "feedOnly",
      "both",
    ]);
  });

  it("두 타입을 함께 응모한 사람은 선택한 타입의 채널만 보여준다", () => {
    const filtered = filterRowsByCapacityChip(
      rows,
      chip({ subType: "INSTAGRAM", option: "REELS" }),
    );
    const both = filtered.find((item) => item.applicationId === "both");
    expect(both?.channels).toEqual([channel("REELS")]);
  });

  it("옵션 없는 서브타입 칩이면 서브타입 전체를 남긴다", () => {
    const filtered = filterRowsByCapacityChip(
      rows,
      chip({ subType: "INSTAGRAM", option: null }),
    );
    expect(filtered).toHaveLength(3);
  });
});
