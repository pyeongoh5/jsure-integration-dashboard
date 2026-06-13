import styles from "@/pages/Applicants/Applicants.module.css";
import { STATUS_TABS, type ApplicantStatus, type StatusCounts } from "./types";

type Props = {
  value: ApplicantStatus;
  counts: StatusCounts;
  onChange: (next: ApplicantStatus) => void;
};

export function ApplicantTabs({ value, counts, onChange }: Props) {
  return (
    <div className={styles.tabs}>
      {STATUS_TABS.map((tab) => (
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
