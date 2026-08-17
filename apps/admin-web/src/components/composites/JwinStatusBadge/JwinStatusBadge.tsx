import type { AdminCampaignListItem } from "@/domains/jwin";
import styles from "./JwinStatusBadge.module.css";

type CampaignStatus = AdminCampaignListItem["status"];

const STATUS_LABEL: Record<CampaignStatus, string> = {
  SETUP: "준비",
  ACTIVE: "진행중",
  PAUSED: "일시중지",
  ENDED: "종료",
};

const STATUS_CLASS: Record<CampaignStatus, string | undefined> = {
  SETUP: styles.setup,
  ACTIVE: styles.active,
  PAUSED: styles.paused,
  ENDED: styles.ended,
};

type Props = {
  status: CampaignStatus;
};

export function JwinStatusBadge({ status }: Props) {
  const label = STATUS_LABEL[status];
  return (
    <span
      className={`${styles.badge} ${STATUS_CLASS[status] ?? ""}`}
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  );
}
