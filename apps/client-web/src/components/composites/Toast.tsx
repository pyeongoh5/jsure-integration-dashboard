import { useEffect } from "react";
import { t } from "@i18n";
import styles from "./Toast.module.css";

interface Props {
  message: string;
  onDismiss: () => void;
  /** 자동 닫힘 시간(ms). 0 이면 자동 닫힘 없음. */
  autoDismissMs?: number;
  variant?: "error" | "info";
}

export function Toast({
  message,
  onDismiss,
  autoDismissMs = 4000,
  variant = "error",
}: Props) {
  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [message, autoDismissMs, onDismiss]);

  return (
    <div
      className={`${styles.root} ${variant === "info" ? styles.info : styles.error}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.close}
        onClick={onDismiss}
        aria-label={t("components.toast.closeAriaLabel")}
      >
        ×
      </button>
    </div>
  );
}
