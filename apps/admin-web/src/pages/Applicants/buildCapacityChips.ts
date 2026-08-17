import {
  SUB_TYPE_LABEL,
  SUB_TYPE_OPTION_LABEL,
  usesOptionCountSplit,
  type ApprovedApplicantExportRow,
  type CampaignResponse,
} from "@jsure/shared";

export type CapacityChip = {
  key: string;
  label: string;
  approved: number;
  total: number;
};

/**
 * 승인자 명단 모달의 정원 칩 목록.
 * 옵션별 정원 분리(피드/릴스)는 옵션 단위, 아니면 서브타입 단위.
 * 단위가 2개 이상이면 맨 앞에 캠페인 전체(응모자 수 기준) 칩을 붙인다.
 */
export function buildCapacityChips(
  campaign: CampaignResponse,
  rows: ApprovedApplicantExportRow[],
): CapacityChip[] {
  // 단순 리뷰는 모집 인원이 캠페인 공통 — 칩 하나로 충분.
  if (campaign.category === "SIMPLE_REVIEW") {
    const total = campaign.recruits[0]?.recruitCount ?? 0;
    return [{ key: "all", label: "정원", approved: rows.length, total }];
  }
  const channels = rows.flatMap((row) => row.channels);
  const units = campaign.recruits.flatMap((recruit): CapacityChip[] =>
    usesOptionCountSplit(recruit)
      ? recruit.options.map((optionConfig) => ({
          key: `${recruit.subType}:${optionConfig.option}`,
          label:
            SUB_TYPE_OPTION_LABEL[optionConfig.option] ?? optionConfig.option,
          approved: channels.filter(
            (channel) =>
              channel.subType === recruit.subType &&
              channel.option === optionConfig.option,
          ).length,
          total: optionConfig.recruitCount ?? 0,
        }))
      : [
          {
            key: recruit.subType,
            label: SUB_TYPE_LABEL[recruit.subType],
            approved: channels.filter(
              (channel) => channel.subType === recruit.subType,
            ).length,
            total: recruit.recruitCount,
          },
        ],
  );
  if (units.length <= 1) {
    return units.map((unit) => ({ ...unit, label: "정원" }));
  }
  const totalCapacity = campaign.recruits.reduce(
    (sum, recruit) => sum + recruit.recruitCount,
    0,
  );
  return [
    { key: "total", label: "전체", approved: rows.length, total: totalCapacity },
    ...units,
  ];
}
