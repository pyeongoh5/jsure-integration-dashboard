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
  /** ID(핸들) 입력 검증 에러 메시지. 있으면 입력창 아래에 표시. */
  handleError?: string;
  /** ID(핸들) 입력창 블러 시 호출 — 해당 필드 검증 트리거용. */
  onHandleBlur?: () => void;
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
  handleError,
  onHandleBlur,
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
              onBlur={onHandleBlur}
              placeholder="ID"
              aria-invalid={handleError ? true : undefined}
            />
            {handleError && (
              <span
                style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}
              >
                {handleError}
              </span>
            )}
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
