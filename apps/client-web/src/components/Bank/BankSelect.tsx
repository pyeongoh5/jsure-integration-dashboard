import { useMemo, useState } from "react";
import { JP_BANKS, type JpBank } from "@jsure/shared";
import "./BankSelect.css";

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
    <div className="bs">
      <button
        type="button"
        className={`bs__field ${!value ? "bs__field--placeholder" : ""}`}
        onClick={() => setOpen(true)}
      >
        <i className="fa-solid fa-magnifying-glass bs__icon" />
        {value ? `${value.name} (${value.code})` : "銀行を検索"}
      </button>

      {open && (
        <div className="bs__modal" role="dialog" aria-modal="true">
          <div className="bs__modal-head">
            <button
              type="button"
              className="bs__close"
              onClick={() => setOpen(false)}
              aria-label="閉じる"
            >
              <i className="fa-solid fa-xmark" />
            </button>
            <input
              autoFocus
              className="bs__search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="銀行名 / 4桁コード"
            />
          </div>
          <div className="bs__list">
            {filtered.length === 0 && (
              <div className="bs__empty">該当する銀行がありません</div>
            )}
            {filtered.map((b) => (
              <button
                type="button"
                key={b.code}
                className="bs__item"
                onClick={() => pick(b)}
              >
                <span className="bs__code">{b.code}</span>
                <span className="bs__name">{b.nameJa}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
