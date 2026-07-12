import { CATEGORY_LABEL_JA, type CampaignCategory } from "@jsure/shared";
import styles from "./CategoryTabBar.module.css";
import { t } from "@i18n";

const TAB_CATEGORIES: readonly CampaignCategory[] = [ // new
  "SNS",
  "FAKE_PURCHASE",
  "SIMPLE_REVIEW",
];

const CATEGORY_LABEL: Record<CampaignCategory, string> = { // new
  SNS: t("campaign.category.sns"),
  FAKE_PURCHASE: t("campaign.category.fakePurchase"),
  SIMPLE_REVIEW: t("campaign.category.simpleReview"),
};

// CATEGORY_LABEL_JA 는 shared 로부터 라벨 폴백용으로 유지 (일본어 우선 확정 시 사용).
void CATEGORY_LABEL_JA;

interface Props { // new
  value: CampaignCategory;
  onChange: (category: CampaignCategory) => void;
}

export function CategoryTabBar({ value, onChange }: Props) { // new
  return (
    <div className={styles.bar}>
      {TAB_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          className={`${styles.pill} ${value === category ? styles.pillOn : ""}`}
          onClick={() => onChange(category)}
        >
          {CATEGORY_LABEL[category]}
        </button>
      ))}
    </div>
  );
}
