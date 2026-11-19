import styles from "@/pages/Campaigns/Campaigns.module.css";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { useT } from "@/lib/i18n";
import {
  STATUS_LABEL,
  type CampaignCategory,
  type CampaignManager,
  type CampaignStatus,
} from "../types";
import { CampaignManagerChips } from "./CampaignManagerChips";

// 카드는 뱃지·D-day 와 한 줄을 나눠 쓴다. 2명을 펼치면 이름이 긴 담당자에서
// 칩이 D-day 를 밀어내므로 1명만 펼치고 나머지는 +N 으로 접는다.
const MAX_VISIBLE_CARD_MANAGER_LABELS = 1;

type Props = {
  status: CampaignStatus;
  category: CampaignCategory;
  dday: number;
  /** 일부 공개(대상자 전용) 캠페인이면 상태·카테고리 옆에 뱃지를 하나 더 붙인다. */
  isRestricted: boolean;
  managers: CampaignManager[];
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

export function CampaignCardTitle({ status, category, dday, isRestricted, managers }: Props) {
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
        {isRestricted && (
          <span className={styles.cardRestricted}>
            {t("domains.campaign.audience.restrictedBadge")}
          </span>
        )}
      </span>
      <span className={styles.cardRight}>
        <CampaignManagerChips managers={managers} maxVisible={MAX_VISIBLE_CARD_MANAGER_LABELS} />
        {status === "recruit" && (
          <span className={`${styles.cardDday} ${dday <= 7 ? styles.cardDdayUrgent : ""}`}>
            D-{dday}
          </span>
        )}
      </span>
    </div>
  );
}
