import {
  optionCapacitySlots,
  subTypesWithAllOptionsFull,
} from "./option-capacity";

const splitRecruit = {
  subType: "INSTAGRAM" as const,
  options: [
    { option: "FEED", recruitCount: 5 },
    { option: "REELS", recruitCount: 5 },
  ],
};

describe("optionCapacitySlots", () => {
  it("정원 분리를 쓰는 recruit 의 옵션을 평탄화한다", () => {
    expect(optionCapacitySlots([splitRecruit])).toEqual([
      { subType: "INSTAGRAM", option: "FEED", recruitCount: 5 },
      { subType: "INSTAGRAM", option: "REELS", recruitCount: 5 },
    ]);
  });

  it("옵션이 없으면 대상이 아니다", () => {
    expect(
      optionCapacitySlots([{ subType: "TIKTOK", options: [] }]),
    ).toEqual([]);
  });

  it("일부 옵션에만 정원이 있으면 분리로 보지 않는다", () => {
    expect(
      optionCapacitySlots([
        {
          subType: "INSTAGRAM",
          options: [
            { option: "FEED", recruitCount: 5 },
            { option: "REELS", recruitCount: null },
          ],
        },
      ]),
    ).toEqual([]);
  });
});

describe("subTypesWithAllOptionsFull", () => {
  it("모든 옵션이 차면 서브타입도 마감으로 본다", () => {
    expect(
      subTypesWithAllOptionsFull(
        [splitRecruit],
        [
          { subType: "INSTAGRAM", option: "FEED" },
          { subType: "INSTAGRAM", option: "REELS" },
        ],
      ),
    ).toEqual(["INSTAGRAM"]);
  });

  it("한 옵션이라도 남으면 마감이 아니다", () => {
    expect(
      subTypesWithAllOptionsFull(
        [splitRecruit],
        [{ subType: "INSTAGRAM", option: "REELS" }],
      ),
    ).toEqual([]);
  });

  it("다른 서브타입의 마감은 영향을 주지 않는다", () => {
    expect(
      subTypesWithAllOptionsFull(
        [splitRecruit],
        [
          { subType: "TIKTOK", option: "FEED" },
          { subType: "TIKTOK", option: "REELS" },
        ],
      ),
    ).toEqual([]);
  });
});
