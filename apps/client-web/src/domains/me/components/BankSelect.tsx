import { useMemo, useState } from "react";
import { JP_BANKS, type JpBank } from "@jsure/shared";
import { t } from "@i18n";
import styles from "./BankSelect.module.css";

interface Props {
  value: { code: string; name: string } | null;
  onChange: (b: { code: string; name: string }) => void;
}

const SCROLL_BATCH = 50;

export function BankSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(SCROLL_BATCH);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return JP_BANKS;
    return JP_BANKS.filter(
      (b) => b.nameJa.includes(q) || b.code.startsWith(q),
    );
  }, [query]);

  function updateQuery(next: string) {
    setQuery(next);
    setVisibleCount(SCROLL_BATCH);
  }

  // 바닥 근처까지 스크롤하면 다음 배치 렌더 (무한 스크롤)
  function handleListScroll(event: React.UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 200) {
      setVisibleCount((count) => Math.min(count + SCROLL_BATCH, filtered.length));
    }
  }

  function pick(b: JpBank) {
    onChange({ code: b.code, name: b.nameJa });
    setOpen(false);
    updateQuery("");
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={[styles.field, !value ? styles.fieldPlaceholder : ""].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
      >
        <i className={`fa-solid fa-magnifying-glass ${styles.icon}`} />
        {value ? `${value.name} (${value.code})` : t("me.bank.searchTrigger")}
      </button>

      {open && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalHead}>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label={t("me.bank.closeAriaLabel")}
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <input
              autoFocus
              className={styles.search}
              type="text"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder={t("me.bank.searchPlaceholder")}
            />
          </div>
          <div className={styles.list} onScroll={handleListScroll}>
            {filtered.length === 0 && (
              <div className={styles.empty}>{t("me.bank.empty")}</div>
            )}
            {filtered.slice(0, visibleCount).map((b) => (
              <button
                type="button"
                key={b.code}
                className={styles.item}
                onClick={() => pick(b)}
              >
                <span className={styles.code}>{b.code}</span>
                <span className={styles.name}>{b.nameJa}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
