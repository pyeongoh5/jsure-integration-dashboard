import styles from "@/pages/Campaigns/Campaigns.module.css";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { useT } from "@/lib/i18n";
import { STATUS_LABEL, type CampaignCategory, type CampaignStatus } from "../types";

type Props = {
  status: CampaignStatus;
  category: CampaignCategory;
  dday: number;
};

const STATUS_CLASS: Record<CampaignStatus, string | undefined> = {
  recruit: styles.cardStatusRecruit,
  full: styles.cardStatusFull,
  done: styles.cardStatusDone,
  draft: styles.cardStatusDraft,
  hidden: styles.cardStatusHidden,
};

const CATEGORY_CLASS: Record<CampaignCategory, string | undefined> = {
  SNS: styles.cardCategorySns,
  FAKE_PURCHASE: styles.cardCategoryFake,
  SIMPLE_REVIEW: styles.cardCategorySimpleReview,
};

export function CampaignCardTitle({ status, category, dday }: Props) {
  const t = useT();
  return (
    <div className={styles.titleWrapper}>
      <span className={styles.cardLeft}>
        <span className={`${styles.cardStatus} ${STATUS_CLASS[status]}`}>
          {t(STATUS_LABEL[status])}
        </span>
        <span className={`${styles.cardCategory} ${CATEGORY_CLASS[category]}`}>
          {t(CATEGORY_LABEL_KO[category])}
        </span>
      </span>
      {status === "recruit" && (
        <span className={`${styles.cardDday} ${dday <= 7 ? styles.cardDdayUrgent : ""}`}>
          D-{dday}
        </span>
      )}
    </div>
  );
}
