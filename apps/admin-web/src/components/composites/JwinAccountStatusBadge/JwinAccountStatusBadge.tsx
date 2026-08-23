import type { AdminBrandAccount } from "@/domains/jwin";
import styles from "./JwinAccountStatusBadge.module.css";

type Status = AdminBrandAccount["status"];

const LABEL: Record<Status, string> = {
  PENDING: "대기",
  CONNECTED: "연동됨",
  NEEDS_RECONNECT: "재연동 필요",
};
const CLASS: Record<Status, string | undefined> = {
  PENDING: styles.pending,
  CONNECTED: styles.connected,
  NEEDS_RECONNECT: styles.reconnect,
};

export function JwinAccountStatusBadge({ status }: { status: Status }) {
  const label = LABEL[status];
  return (
    <span className={`${styles.badge} ${CLASS[status] ?? ""}`} title={label} aria-label={label}>
      {label}
    </span>
  );
}
