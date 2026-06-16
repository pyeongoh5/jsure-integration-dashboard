import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import applicantStyles from "@/pages/Applicants/Applicants.module.css";
import { DRAFT_STATUS_OPTIONS, type DraftStatus } from "./types";

type Props = {
  value: Set<DraftStatus>;
  onChange: (next: Set<DraftStatus>) => void;
};

// 응모자 페이지의 stage 필터와 동일한 룩&필을 재사용. 별도 CSS 모듈 없이 Applicants.module.css 만 import.
export function DraftStatusFilter({ value, onChange }: Props) {
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

  const toggle = (status: DraftStatus) => {
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

  const selectedLabel = DRAFT_STATUS_OPTIONS.filter((option) =>
    value.has(option.key),
  )
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${applicantStyles.filter} ${value.size > 0 ? applicantStyles.filterActive : ""}`}
        onClick={openPopover}
      >
        {value.size > 0 ? `상태: ${selectedLabel}` : "+ 상태"}
        {value.size > 0 && (
          <span
            className={applicantStyles.popoverBtn}
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
            className={applicantStyles.popover}
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            <div className={applicantStyles.popoverTitle}>상태 선택 (복수 가능)</div>
            <div className={applicantStyles.popoverItems}>
              {DRAFT_STATUS_OPTIONS.map((option) => {
                const selected = value.has(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    className={`${applicantStyles.popoverOption}${
                      selected ? ` ${applicantStyles.popoverOptionOn}` : ""
                    }`}
                    onClick={() => toggle(option.key)}
                  >
                    <span className={applicantStyles.popoverOptionLabel}>
                      {option.label}
                    </span>
                    {selected && (
                      <i
                        className={`fa-solid fa-check ${applicantStyles.popoverOptionCheck}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className={applicantStyles.popoverActions}>
              <button
                type="button"
                className={`${applicantStyles.popoverBtn} ${applicantStyles.popoverBtnPrimary}`}
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
