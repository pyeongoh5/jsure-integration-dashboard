import { useState } from "react";
import type { ConsentItem } from "@jsure/shared";
import { INFLUENCER_TERMS } from "@jsure/shared";
import { t } from "@/i18n";
import styles from "./TermsAccordion.module.css";

interface Props {
  agreed: Set<ConsentItem>;
  onToggle: (k: ConsentItem) => void;
  onToggleAll: () => void;
}

export function TermsAccordion({ agreed, onToggle, onToggleAll }: Props) {
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
    <div>
      <button
        type="button"
        className={styles.all}
        onClick={onToggleAll}
      >
        <span className={[styles.chk, allChecked ? styles.chkOn : ""].filter(Boolean).join(" ")}>
          {allChecked ? "✓" : ""}
        </span>
        <span>{t("auth.terms.agreeAll")}</span>
      </button>

      {INFLUENCER_TERMS.map((term) => {
        const on = agreed.has(term.key);
        const open = expanded.has(term.key);
        return (
          <div key={term.key} className={styles.item}>
            <div className={styles.head}>
              <button
                type="button"
                className={styles.chkBtn}
                aria-label={on ? t("auth.terms.uncheckAriaLabel") : t("auth.terms.checkAriaLabel")}
                onClick={() => onToggle(term.key)}
              >
                <span className={[styles.chk, on ? styles.chkOn : ""].filter(Boolean).join(" ")}>
                  {on ? "✓" : ""}
                </span>
              </button>
              <button
                type="button"
                className={styles.labelBtn}
                onClick={() => toggleExpand(term.key)}
              >
                <span className={styles.req}>{t("auth.terms.requiredTag")}</span>
                <span className={styles.title}>{term.title}</span>
                <i
                  className={`fa-solid fa-chevron-down ${styles.caret} ${open ? styles.caretOpen : ""}`}
                />
              </button>
            </div>
            {open && (
              <div className={styles.body}>
                <div>{term.bodyJa}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
