import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isEnabledSnsType, type SnsType } from "@jsure/shared";
import type { StatusFilter } from "../filter";
import styles from "./ApplicationFilters.module.css";

const STATUS_OPTIONS: { value: Exclude<StatusFilter, "all">; label: string }[] =
  [
    { value: "applied", label: "応募" },
    { value: "rejected", label: "未選定" },
    { value: "in_progress", label: "進行中" },
    { value: "ended", label: "終了" },
  ];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "",
  applied: "応募",
  rejected: "未選定",
  in_progress: "進行中",
  ended: "終了",
};

const SNS_OPTIONS: { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];
const VISIBLE_SNS_OPTIONS = SNS_OPTIONS.filter((opt) =>
  isEnabledSnsType(opt.value),
);

type PopoverKind = "status" | "sns";

type Props = {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  selectedSnsTypes: Set<SnsType>;
  onToggleSns: (snsType: SnsType) => void;
  onClearSns: () => void;
};

export function ApplicationFilters({
  statusFilter,
  onStatusChange,
  selectedSnsTypes,
  onToggleSns,
  onClearSns,
}: Props) {
  const [popover, setPopover] = useState<{
    kind: PopoverKind;
    rect: DOMRect;
  } | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const snsButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (statusButtonRef.current?.contains(target)) return;
      if (snsButtonRef.current?.contains(target)) return;
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

  const openPopover = (
    kind: PopoverKind,
    anchor: HTMLButtonElement | null,
  ) => {
    if (!anchor) return;
    if (popover?.kind === kind) {
      setPopover(null);
      return;
    }
    setPopover({ kind, rect: anchor.getBoundingClientRect() });
  };

  const selectedSnsLabel = VISIBLE_SNS_OPTIONS.filter((option) =>
    selectedSnsTypes.has(option.value),
  )
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <div className={styles.bar}>
        <button
          ref={snsButtonRef}
          type="button"
          className={`${styles.chip} ${
            selectedSnsTypes.size > 0 ? styles.chipActive : ""
          }`}
          onClick={() => openPopover("sns", snsButtonRef.current)}
        >
          {selectedSnsTypes.size > 0 ? `SNS: ${selectedSnsLabel}` : "+ SNS"}
          {selectedSnsTypes.size > 0 && (
            <span
              className={styles.clear}
              onClick={(event) => {
                event.stopPropagation();
                onClearSns();
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>

        <button
          ref={statusButtonRef}
          type="button"
          className={`${styles.chip} ${
            statusFilter !== "all" ? styles.chipActive : ""
          }`}
          onClick={() => openPopover("status", statusButtonRef.current)}
        >
          {statusFilter !== "all"
            ? `状態: ${STATUS_LABEL[statusFilter]}`
            : "+ 状態"}
          {statusFilter !== "all" && (
            <span
              className={styles.clear}
              onClick={(event) => {
                event.stopPropagation();
                onStatusChange("all");
                setPopover(null);
              }}
            >
              {" "}
              ✕
            </span>
          )}
        </button>
      </div>

      {popover &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            {popover.kind === "status" ? (
              <>
                <div className={styles.popoverTitle}>状態を選択</div>
                <div className={styles.popoverItems}>
                  {STATUS_OPTIONS.map((option) => {
                    const selected = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.popoverOption}${
                          selected ? ` ${styles.popoverOptionOn}` : ""
                        }`}
                        onClick={() => {
                          onStatusChange(option.value);
                          setPopover(null);
                        }}
                      >
                        <span>{option.label}</span>
                        {selected && (
                          <span className={styles.popoverCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className={styles.popoverTitle}>SNSを選択（複数可）</div>
                <div className={styles.popoverItems}>
                  {VISIBLE_SNS_OPTIONS.map((option) => {
                    const selected = selectedSnsTypes.has(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.popoverOption}${
                          selected ? ` ${styles.popoverOptionOn}` : ""
                        }`}
                        onClick={() => onToggleSns(option.value)}
                      >
                        <span>{option.label}</span>
                        {selected && (
                          <span className={styles.popoverCheck}>✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.popoverActions}>
                  <button
                    type="button"
                    className={styles.popoverClose}
                    onClick={() => setPopover(null)}
                  >
                    閉じる
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
