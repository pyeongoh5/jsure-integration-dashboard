import { isCampaignFull, optionKey } from "./campaign-fullness";

type Recruit = {
  subType: "INSTAGRAM" | "TIKTOK" | "LIPS" | "ATCOSME";
  recruitCount: number;
  isRequired: boolean;
  options: { option: string; recruitCount: number | null }[];
};

function recruit(partial: Partial<Recruit> & Pick<Recruit, "subType">): Recruit {
  return { recruitCount: 0, isRequired: false, options: [], ...partial };
}

describe("isCampaignFull", () => {
  it("전부 선택 서브타입 — 일부만 마감이면 full 아님 (버그 재현: IG 55/57, TIKTOK 10/15)", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [
        recruit({
          subType: "INSTAGRAM",
          recruitCount: 57,
          options: [
            { option: "FEED", recruitCount: 39 },
            { option: "REELS", recruitCount: 18 },
          ],
        }),
        recruit({ subType: "TIKTOK", recruitCount: 15 }),
      ],
      subTypeApproved: new Map([
        ["INSTAGRAM", 55],
        ["TIKTOK", 10],
      ]),
      optionApproved: new Map([
        [optionKey("INSTAGRAM", "FEED"), 37],
        [optionKey("INSTAGRAM", "REELS"), 18],
      ]),
    });
    expect(full).toBe(false);
  });

  it("전부 선택 서브타입 — 모두 마감이면 full", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [
        recruit({ subType: "INSTAGRAM", recruitCount: 10 }),
        recruit({ subType: "TIKTOK", recruitCount: 5 }),
      ],
      subTypeApproved: new Map([
        ["INSTAGRAM", 10],
        ["TIKTOK", 5],
      ]),
      optionApproved: new Map(),
    });
    expect(full).toBe(true);
  });

  it("필수 서브타입이 마감이면 선택 슬롯이 남아도 full (모든 응모가 필수를 포함)", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [
        recruit({ subType: "INSTAGRAM", recruitCount: 10, isRequired: true }),
        recruit({ subType: "TIKTOK", recruitCount: 5 }),
      ],
      subTypeApproved: new Map([
        ["INSTAGRAM", 10],
        ["TIKTOK", 0],
      ]),
      optionApproved: new Map(),
    });
    expect(full).toBe(true);
  });

  it("필수 서브타입이 미달이면 선택이 전부 마감이어도 full 아님", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [
        recruit({ subType: "INSTAGRAM", recruitCount: 10, isRequired: true }),
        recruit({ subType: "TIKTOK", recruitCount: 5 }),
      ],
      subTypeApproved: new Map([
        ["INSTAGRAM", 9],
        ["TIKTOK", 5],
      ]),
      optionApproved: new Map(),
    });
    expect(full).toBe(false);
  });

  it("옵션 분리 서브타입 — 정원 미달이어도 모든 옵션이 마감이면 그 서브타입은 마감", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [
        recruit({
          subType: "INSTAGRAM",
          recruitCount: 57,
          isRequired: true,
          options: [
            { option: "FEED", recruitCount: 39 },
            { option: "REELS", recruitCount: 18 },
          ],
        }),
      ],
      subTypeApproved: new Map([["INSTAGRAM", 50]]),
      optionApproved: new Map([
        [optionKey("INSTAGRAM", "FEED"), 39],
        [optionKey("INSTAGRAM", "REELS"), 18],
      ]),
    });
    expect(full).toBe(true);
  });

  it("SIMPLE_REVIEW — 전 서브타입 동시 참여라 공통 정원 도달 시 full", () => {
    const full = isCampaignFull({
      category: "SIMPLE_REVIEW",
      recruits: [
        recruit({ subType: "LIPS", recruitCount: 25 }),
        recruit({ subType: "ATCOSME", recruitCount: 25 }),
      ],
      subTypeApproved: new Map([
        ["LIPS", 25],
        ["ATCOSME", 25],
      ]),
      optionApproved: new Map(),
    });
    expect(full).toBe(true);
  });

  it("recruits 가 비어 있으면 full 아님", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [],
      subTypeApproved: new Map(),
      optionApproved: new Map(),
    });
    expect(full).toBe(false);
  });

  it("정원 0(미설정) 서브타입은 마감으로 치지 않음", () => {
    const full = isCampaignFull({
      category: "SNS",
      recruits: [recruit({ subType: "INSTAGRAM", recruitCount: 0 })],
      subTypeApproved: new Map([["INSTAGRAM", 3]]),
      optionApproved: new Map(),
    });
    expect(full).toBe(false);
  });
});
