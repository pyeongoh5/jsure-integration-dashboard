import styles from "@/pages/Campaigns/Campaigns.module.css";
import { STATUS_LABEL, type CampaignStatus } from "../types";

type Props = {
  status: CampaignStatus;
  dday: number;
};

const STATUS_CLASS: Record<CampaignStatus, string | undefined> = {
  recruit: styles.cardStatusRecruit,
  done: styles.cardStatusDone,
};

export function CampaignCardTitle({ status, dday }: Props) {
  return (
    <div className={styles.titleWrapper}>
      <span className={`${styles.cardStatus} ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
      {status !== "done" && (
        <span className={`${styles.cardDday} ${dday <= 7 ? styles.cardDdayUrgent : ""}`}>
          D-{dday}
        </span>
      )}
    </div>
  );
}
