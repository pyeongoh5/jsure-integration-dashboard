import { useState } from "react";
import type { ConsentItem } from "@jsure/shared";
import { INFLUENCER_TERMS } from "@jsure/shared";
import "./TermsAccordion.css";

interface Props {
  agreed: Set<ConsentItem>;
  onToggle: (k: ConsentItem) => void;
  onToggleAll: () => void;
  showKorean: boolean;
  onToggleKorean: () => void;
}

export function TermsAccordion({
  agreed,
  onToggle,
  onToggleAll,
  showKorean,
  onToggleKorean,
}: Props) {
  const [expanded, setExpanded] = useState<Set<ConsentItem>>(new Set());
  const allChecked = INFLUENCER_TERMS.every((t) => agreed.has(t.key));

  function toggleExpand(k: ConsentItem) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="terms">
      <button
        type="button"
        className={`terms__all ${allChecked ? "terms__all--on" : ""}`}
        onClick={onToggleAll}
      >
        <span className={`terms__chk ${allChecked ? "terms__chk--on" : ""}`}>
          {allChecked ? "✓" : ""}
        </span>
        <span>すべての項目に同意します</span>
      </button>

      <label className="terms__kr-toggle">
        <input
          type="checkbox"
          checked={showKorean}
          onChange={onToggleKorean}
        />
        <span>한국어 설명 보기</span>
      </label>

      {INFLUENCER_TERMS.map((term) => {
        const on = agreed.has(term.key);
        const open = expanded.has(term.key);
        return (
          <div key={term.key} className="terms__item">
            <div className="terms__head">
              <button
                type="button"
                className="terms__chk-btn"
                aria-label={on ? "解除" : "同意"}
                onClick={() => onToggle(term.key)}
              >
                <span className={`terms__chk ${on ? "terms__chk--on" : ""}`}>
                  {on ? "✓" : ""}
                </span>
              </button>
              <button
                type="button"
                className="terms__label-btn"
                onClick={() => toggleExpand(term.key)}
              >
                <span className="terms__req">[必須]</span>
                <span className="terms__title">{term.title}</span>
                <i
                  className={`fa-solid fa-chevron-down terms__caret ${open ? "terms__caret--open" : ""}`}
                />
              </button>
            </div>
            {open && (
              <div className="terms__body">
                <div>{term.bodyJa}</div>
                {showKorean && (
                  <div className="terms__body-ko">{term.bodyKo}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
