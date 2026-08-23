import type { AdminTranslationKey } from "@i18n/admin";
import type { AdminBrandAccount } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinAccountStatusBadge.module.css";

type Status = AdminBrandAccount["status"];

const LABEL_KEY: Record<Status, AdminTranslationKey> = {
  PENDING: "jwin.account.status.pending",
  CONNECTED: "jwin.account.status.connected",
  NEEDS_RECONNECT: "jwin.account.status.needsReconnect",
};
const CLASS: Record<Status, string | undefined> = {
  PENDING: styles.pending,
  CONNECTED: styles.connected,
  NEEDS_RECONNECT: styles.reconnect,
};

export function JwinAccountStatusBadge({ status }: { status: Status }) {
  const t = useT();
  const label = t(LABEL_KEY[status]);
  return (
    <span className={`${styles.badge} ${CLASS[status] ?? ""}`} title={label} aria-label={label}>
      {label}
    </span>
  );
}
