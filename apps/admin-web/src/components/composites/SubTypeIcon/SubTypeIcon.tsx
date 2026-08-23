import { SUB_TYPE_LABEL, type CampaignSubType } from "@jsure/shared";
import styles from "./SubTypeIcon.module.css";

/** Font Awesome 클래스. 응모자 관리·검토 테이블에서 쓰던 아이콘 그대로. */
const SUB_TYPE_ICON_CLASS: Record<CampaignSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
  QOO10: "fa-solid fa-bag-shopping",
  LIPS: "fa-solid fa-heart",
  ATCOSME: "fa-solid fa-star",
};

const BRAND_CLASS: Record<CampaignSubType, string | undefined> = {
  INSTAGRAM: styles.brandInstagram,
  TIKTOK: styles.brandTiktok,
  X: styles.brandX,
  YOUTUBE: styles.brandYoutube,
  QOO10: styles.brandNeutral,
  LIPS: styles.brandNeutral,
  ATCOSME: styles.brandNeutral,
};

type Props = {
  subType: CampaignSubType;
  /** 목록 셀은 기본(28px), 다이얼로그 안의 촘촘한 줄은 sm(20px). */
  size?: "md" | "sm";
};

export function SubTypeIcon({ subType, size = "md" }: Props) {
  const label = SUB_TYPE_LABEL[subType];
  return (
    <span
      className={`${styles.icon} ${size === "sm" ? styles.iconSm : ""} ${BRAND_CLASS[subType] ?? ""}`}
      title={label}
      aria-label={label}
    >
      <i className={SUB_TYPE_ICON_CLASS[subType]} aria-hidden="true" />
    </span>
  );
}
