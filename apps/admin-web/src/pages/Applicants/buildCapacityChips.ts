import {
  SUB_TYPE_LABEL,
  usesOptionCountSplit,
  type ApprovedApplicantExportRow,
  type CampaignResponse,
  type CampaignSubType,
} from "@jsure/shared";
import { subTypeOptionLabel } from "@/domains/application/subTypeOptionLabel";
import type { AdminTranslationKey } from "@i18n/admin";

export type CapacityChip = {
  key: string;
  label: string;
  approved: number;
  total: number;
  /** 이 칩이 가리키는 승인 단위. null 이면 전체(필터 없음). */
  match: { subType: CampaignSubType; option: string | null } | null;
};

type TranslateFunction = (key: AdminTranslationKey) => string;

/**
 * 승인자 명단 모달의 정원 칩 목록.
 * 옵션별 정원 분리(피드/릴스)는 옵션 단위, 아니면 서브타입 단위.
 * 단위가 2개 이상이면 맨 앞에 캠페인 전체(응모자 수 기준) 칩을 붙인다.
 */
export function buildCapacityChips(
  campaign: CampaignResponse,
  rows: ApprovedApplicantExportRow[],
  translateLabel: TranslateFunction,
): CapacityChip[] {
  const capacityLabel = translateLabel("pages.applicants.approvedDialog.capacity");
  // 단순 리뷰는 모집 인원이 캠페인 공통 — 칩 하나로 충분.
  if (campaign.category === "SIMPLE_REVIEW") {
    const total = campaign.recruits[0]?.recruitCount ?? 0;
    return [
      { key: "all", label: capacityLabel, approved: rows.length, total, match: null },
    ];
  }
  const channels = rows.flatMap((row) => row.channels);
  const units = campaign.recruits.flatMap((recruit): CapacityChip[] =>
    usesOptionCountSplit(recruit)
      ? recruit.options.map((optionConfig) => ({
          key: `${recruit.subType}:${optionConfig.option}`,
          label: subTypeOptionLabel(optionConfig.option, translateLabel),
          approved: channels.filter(
            (channel) =>
              channel.subType === recruit.subType &&
              channel.option === optionConfig.option,
          ).length,
          total: optionConfig.recruitCount ?? 0,
          match: { subType: recruit.subType, option: optionConfig.option },
        }))
      : [
          {
            key: recruit.subType,
            label: SUB_TYPE_LABEL[recruit.subType],
            approved: channels.filter(
              (channel) => channel.subType === recruit.subType,
            ).length,
            total: recruit.recruitCount,
            match: { subType: recruit.subType, option: null },
          },
        ],
  );
  // 단위가 하나뿐이면 그 칩이 곧 전체 — 필터할 대상이 없다.
  if (units.length <= 1) {
    return units.map((unit) => ({ ...unit, label: capacityLabel, match: null }));
  }
  const totalCapacity = campaign.recruits.reduce(
    (sum, recruit) => sum + recruit.recruitCount,
    0,
  );
  return [
    {
      key: "total",
      label: translateLabel("pages.applicants.approvedDialog.total"),
      approved: rows.length,
      total: totalCapacity,
      match: null,
    },
    ...units,
  ];
}

/**
 * 선택한 칩에 해당하는 승인자만 남긴다.
 * 피드·릴스를 함께 응모한 사람은 SNS 칸에 다른 타입이 섞이지 않도록 채널까지 좁히고,
 * 남은 채널이 없으면 행 자체를 제외한다.
 */
export function filterRowsByCapacityChip(
  rows: ApprovedApplicantExportRow[],
  chip: CapacityChip | undefined,
): ApprovedApplicantExportRow[] {
  const match = chip?.match;
  if (!match) return rows;
  return rows.flatMap((row) => {
    const channels = row.channels.filter(
      (channel) =>
        channel.subType === match.subType &&
        (match.option === null || channel.option === match.option),
    );
    return channels.length > 0 ? [{ ...row, channels }] : [];
  });
}
