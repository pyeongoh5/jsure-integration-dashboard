import styles from "@/pages/Campaigns/Campaigns.module.css";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { STATUS_LABEL, type CampaignCategory, type CampaignStatus } from "../types";

type Props = {
  status: CampaignStatus;
  category: CampaignCategory;
  dday: number;
};

const STATUS_CLASS: Record<CampaignStatus, string | undefined> = {
  recruit: styles.cardStatusRecruit,
  done: styles.cardStatusDone,
};

const CATEGORY_CLASS: Record<CampaignCategory, string | undefined> = {
  SNS: styles.cardCategorySns,
  FAKE_PURCHASE: styles.cardCategoryFake,
  SIMPLE_REVIEW: styles.cardCategorySimpleReview,
};

export function CampaignCardTitle({ status, category, dday }: Props) {
  return (
    <div className={styles.titleWrapper}>
      <span className={styles.cardLeft}>
        <span className={`${styles.cardStatus} ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
        <span className={`${styles.cardCategory} ${CATEGORY_CLASS[category]}`}>
          {CATEGORY_LABEL_KO[category]}
        </span>
      </span>
      {status !== "done" && (
        <span className={`${styles.cardDday} ${dday <= 7 ? styles.cardDdayUrgent : ""}`}>
          D-{dday}
        </span>
      )}
    </div>
  );
}
