import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminCampaignListItem } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinStatusBadge.module.css";

type CampaignStatus = AdminCampaignListItem["status"];

const LABEL_KEY: Record<CampaignStatus, AdminTranslationKey> = {
  SETUP: "jwin.status.setup",
  ACTIVE: "jwin.status.active",
  PAUSED: "jwin.status.paused",
  ENDED: "jwin.status.ended",
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
  const t = useT();
  const label = t(LABEL_KEY[status]);
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
