import { useMemo, useState } from "react";
import { JP_BANKS, type JpBank } from "@jsure/shared";
import styles from "./BankSelect.module.css";

interface Props {
  value: { code: string; name: string } | null;
  onChange: (b: { code: string; name: string }) => void;
}

export function BankSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return JP_BANKS.slice(0, 30);
    return JP_BANKS.filter(
      (b) => b.nameJa.includes(q) || b.code.startsWith(q),
    ).slice(0, 40);
  }, [query]);

  function pick(b: JpBank) {
    onChange({ code: b.code, name: b.nameJa });
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={[styles.field, !value ? styles.fieldPlaceholder : ""].filter(Boolean).join(" ")}
        onClick={() => setOpen(true)}
      >
        <i className={`fa-solid fa-magnifying-glass ${styles.icon}`} />
        {value ? `${value.name} (${value.code})` : "銀行を検索"}
      </button>

      {open && (
        <div className={styles.modal} role="dialog" aria-modal="true">
          <div className={styles.modalHead}>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <input
              autoFocus
              className={styles.search}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="銀行名 / 4桁コード"
            />
          </div>
          <div className={styles.list}>
            {filtered.length === 0 && (
              <div className={styles.empty}>該当する銀行がありません</div>
            )}
            {filtered.map((b) => (
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
