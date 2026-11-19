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
 * 폭을 제한하고, 접힌 인원은 호버 툴팁으로 전원 보여준다.
 */
export function CampaignManagerChips({ managers, maxVisible }: Props) {
  if (managers.length === 0) return null;

  const labels = managers.map((manager) => adminUserLabel(manager));
  const { text, title } = buildMultiSelectLabel(labels, maxVisible);
  // 접힌 인원이 없으면 칩에 이미 전원이 적혀 있어 툴팁이 같은 말을 반복한다.
  const hasHiddenManagers = text !== title;

  return (
    <span className={styles.wrap}>
      <span className={styles.chip}>{text}</span>
      {hasHiddenManagers && (
        <span className={styles.tooltip} role="tooltip">
          {title}
        </span>
      )}
    </span>
  );
}
