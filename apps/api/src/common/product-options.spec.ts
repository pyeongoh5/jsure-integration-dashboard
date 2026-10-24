import { BadRequestException } from "@nestjs/common";
import {
  parseApplicationProductOptions,
  parseCampaignProductOptions,
  selectProductOptions,
} from "./product-options";

const groups = [
  { name: "호수", values: ["19호", "21호", "23호"] },
  { name: "사이즈", values: ["S", "M"] },
];

describe("selectProductOptions", () => {
  it("캠페인 그룹 순서대로 선택값을 확정한다", () => {
    expect(
      selectProductOptions(groups, [
        { name: "사이즈", value: "M" },
        { name: "호수", value: "21호" },
      ]),
    ).toEqual([
      { name: "호수", value: "21호" },
      { name: "사이즈", value: "M" },
    ]);
  });

  it("옵션이 없는 캠페인은 빈 배열", () => {
    expect(selectProductOptions([], [])).toEqual([]);
  });

  it("그룹을 빠뜨리면 거부한다", () => {
    expect(() =>
      selectProductOptions(groups, [{ name: "호수", value: "21호" }]),
    ).toThrow(BadRequestException);
  });

  it("허용되지 않은 값은 거부한다", () => {
    expect(() =>
      selectProductOptions(groups, [
        { name: "호수", value: "25호" },
        { name: "사이즈", value: "M" },
      ]),
    ).toThrow(BadRequestException);
  });

  it("설정에 없는 옵션명은 거부한다", () => {
    expect(() =>
      selectProductOptions([], [{ name: "호수", value: "21호" }]),
    ).toThrow(BadRequestException);
  });

  it("값이 비어 있는 임시저장 잔재 그룹은 선택 대상에서 제외한다", () => {
    expect(selectProductOptions([{ name: "호수", values: [] }], [])).toEqual([]);
  });
});

describe("parse", () => {
  it("깨진 Json 은 빈 배열로 떨어뜨린다", () => {
    expect(parseCampaignProductOptions("broken")).toEqual([]);
    expect(parseApplicationProductOptions([{ name: "호수" }])).toEqual([]);
  });

  it("null 은 빈 배열", () => {
    expect(parseCampaignProductOptions(null)).toEqual([]);
    expect(parseApplicationProductOptions(null)).toEqual([]);
  });
});
