import {
  DRAFT_TABS,
  type DraftReviewCounts,
  type DraftReviewTab,
} from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";

type Props = {
  value: DraftReviewTab;
  counts: DraftReviewCounts;
  onChange: (next: DraftReviewTab) => void;
};

export function DraftTabs({ value, counts, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {DRAFT_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`${styles.tab} ${value === tab.key ? styles.tabActive : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className={styles.tabCount}>{counts[tab.key]}</span>
        </button>
      ))}
    </div>
  );
}
