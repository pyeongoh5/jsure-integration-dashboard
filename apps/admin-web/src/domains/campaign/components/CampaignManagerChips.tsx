import type { CampaignManager } from "@jsure/shared";
import { buildMultiSelectLabel } from "@/components/composites/FilterChip/buildMultiSelectLabel";
import { adminUserLabel } from "@/domains/team";
import styles from "./CampaignManagerChips.module.css";

type Props = {
  managers: CampaignManager[];
  maxVisible: number;
};

/**
 * 운영 담당자 표시 전용 pill. 좁은 카드 안에서 뱃지들과 같은 줄에 서므로
 * 폭을 제한하고, 잘린 이름과 접힌 인원은 호버 툴팁(title)으로 전원 확인한다.
 */
export function CampaignManagerChips({ managers, maxVisible }: Props) {
  if (managers.length === 0) return null;

  const labels = managers.map((manager) => adminUserLabel(manager));
  const { text, title } = buildMultiSelectLabel(labels, maxVisible);

  return (
    <span className={styles.chip} title={title}>
      {text}
    </span>
  );
}
