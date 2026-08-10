import { usesOptionCountSplit, type CampaignSubType } from "@jsure/shared";

type RecruitWithOptions = {
  subType: CampaignSubType;
  options: { option: string; recruitCount: number | null }[];
};

export type OptionSlot = {
  subType: CampaignSubType;
  option: string;
  recruitCount: number;
};

/**
 * 옵션별 정원 분리(FEED/REELS 등)를 쓰는 recruit 들의 옵션 정원을 평탄화한다.
 * 분리를 쓰지 않는 recruit 은 옵션 단위 마감이 없으므로 제외된다.
 */
export function optionCapacitySlots(
  recruits: RecruitWithOptions[],
): OptionSlot[] {
  return recruits.filter(usesOptionCountSplit).flatMap((recruit) =>
    recruit.options.map((option) => ({
      subType: recruit.subType,
      option: option.option,
      recruitCount: option.recruitCount ?? 0,
    })),
  );
}

/**
 * 옵션이 하나도 남지 않은 서브타입 — 서브타입 정원이 남아 있어도 고를 수 있는
 * 옵션이 없으므로 서브타입 자체를 마감으로 본다.
 */
export function subTypesWithAllOptionsFull(
  recruits: RecruitWithOptions[],
  fullOptions: { subType: CampaignSubType; option: string }[],
): CampaignSubType[] {
  return recruits
    .filter(
      (recruit) =>
        usesOptionCountSplit(recruit) &&
        recruit.options.every((option) =>
          fullOptions.some(
            (full) =>
              full.subType === recruit.subType && full.option === option.option,
          ),
        ),
    )
    .map((recruit) => recruit.subType);
}
