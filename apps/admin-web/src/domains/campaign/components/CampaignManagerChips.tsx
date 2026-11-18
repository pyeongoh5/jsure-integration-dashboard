import type { CampaignManager } from "@jsure/shared";
import { buildMultiSelectLabel } from "@/components/composites/FilterChip/buildMultiSelectLabel";
import filterChipStyles from "@/components/composites/FilterChip/FilterChip.module.css";
import { adminUserLabel } from "@/domains/team";

type Props = {
  managers: CampaignManager[];
  maxVisible: number;
};

/** 운영 담당자 표시 전용 pill. 캠페인 관리 페이지와 리포트가 공유한다 (CODE_RULES §8). */
export function CampaignManagerChips({ managers, maxVisible }: Props) {
  if (managers.length === 0) return null;

  const labels = managers.map((manager) => adminUserLabel(manager));
  const { text, title } = buildMultiSelectLabel(labels, maxVisible);

  return (
    <span className={filterChipStyles.staticChip} title={title}>
      {text}
    </span>
  );
}
