import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "@/pages/Applicants/Applicants.module.css";
import { APPLICANT_STATUS_OPTIONS, type ApplicantStatus } from "./types";

type Props = {
  value: Set<ApplicantStatus>;
  onChange: (next: Set<ApplicantStatus>) => void;
};

export function ApplicantStatusFilter({ value, onChange }: Props) {
  const [popover, setPopover] = useState<{ rect: DOMRect } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setPopover(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [popover]);

  const toggle = (status: ApplicantStatus) => {
    const next = new Set(value);
    if (next.has(status)) next.delete(status);
    else next.add(status);
    onChange(next);
  };

  const openPopover = () => {
    const anchor = buttonRef.current;
    if (!anchor) return;
    if (popover) {
      setPopover(null);
      return;
    }
    setPopover({ rect: anchor.getBoundingClientRect() });
  };

  const selectedLabel = APPLICANT_STATUS_OPTIONS.filter((option) =>
    value.has(option.key),
  )
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.filter} ${value.size > 0 ? styles.filterActive : ""}`}
        onClick={openPopover}
      >
        {value.size > 0 ? `상태: ${selectedLabel}` : "+ 상태"}
        {value.size > 0 && (
          <span
            className={styles.popoverBtn}
            onClick={(event) => {
              event.stopPropagation();
              onChange(new Set());
              setPopover(null);
            }}
          >
            {" "}
            ✕
          </span>
        )}
      </button>

      {popover &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            <div className={styles.popoverTitle}>상태 선택 (복수 가능)</div>
            <div className={styles.popoverItems}>
              {APPLICANT_STATUS_OPTIONS.map((option) => {
                const selected = value.has(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`${styles.popoverOption}${
                      selected ? ` ${styles.popoverOptionOn}` : ""
                    }`}
                    onClick={() => toggle(option.key)}
                  >
                    <span className={styles.popoverOptionLabel}>
                      {option.label}
                    </span>
                    {selected && (
                      <i className={`fa-solid fa-check ${styles.popoverOptionCheck}`} />
                    )}
                  </button>
                );
              })}
            </div>
            <div className={styles.popoverActions}>
              <button
                type="button"
                className={`${styles.popoverBtn} ${styles.popoverBtnPrimary}`}
                onClick={() => setPopover(null)}
              >
                닫기
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
