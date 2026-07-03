import type { SnsAccountSubType } from "@jsure/shared";
import { t } from "@i18n";
import styles from "./SnsAccountCard.module.css";

interface Props {
  snsType: SnsAccountSubType;
  enabled: boolean;
  handle: string;
  followerCount: string;
  onToggle: () => void;
  onChange: (field: "handle" | "followerCount", v: string) => void;
}

const ICON: Record<SnsAccountSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

const LABEL: Record<SnsAccountSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

export function SnsAccountCard({
  snsType,
  enabled,
  handle,
  followerCount,
  onToggle,
  onChange,
}: Props) {
  return (
    <div className={[styles.card, enabled ? styles.cardOn : ""].filter(Boolean).join(" ")}>
      <button type="button" className={styles.head} onClick={onToggle}>
        <i className={`${ICON[snsType]} ${styles.icon}`} />
        <span className={styles.name}>{LABEL[snsType]}</span>
        <span className={[styles.toggle, enabled ? styles.toggleOn : ""].filter(Boolean).join(" ")} />
      </button>
      {enabled && (
        <div className={styles.body}>
          <label className={styles.field}>
            <span>ID</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => onChange("handle", e.target.value)}
              placeholder="ID"
            />
          </label>
          <label className={styles.field}>
            <span>{t("auth.snsAccount.followerCount")}</span>
            <input
              type="text"
              inputMode="numeric"
              value={followerCount}
              onChange={(e) => onChange("followerCount", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="12500"
            />
          </label>
        </div>
      )}
    </div>
  );
}
