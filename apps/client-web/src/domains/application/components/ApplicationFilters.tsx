import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isEnabledSnsType, type CampaignSubType, type SnsAccountSubType } from "@jsure/shared";
import { t } from "@i18n";
import type { StatusFilter } from "../filter";
import styles from "./ApplicationFilters.module.css";

const STATUS_OPTIONS: { value: Exclude<StatusFilter, "all">; label: string }[] =
  [
    { value: "applied", label: t("application.filters.statusApplied") },
    { value: "rejected", label: t("application.filters.statusRejected") },
    { value: "in_progress", label: t("application.filters.statusInProgress") },
    { value: "ended", label: t("application.filters.statusEnded") },
    { value: "cancelled", label: t("application.filters.statusCancelled") },
  ];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "",
  applied: t("application.filters.statusApplied"),
  rejected: t("application.filters.statusRejected"),
  in_progress: t("application.filters.statusInProgress"),
  ended: t("application.filters.statusEnded"),
  cancelled: t("application.filters.statusCancelled"),
};

const SNS_OPTIONS: { value: CampaignSubType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];
const VISIBLE_SNS_OPTIONS = SNS_OPTIONS.filter((opt) =>
  isEnabledSnsType(opt.value as SnsAccountSubType),
);

type PopoverKind = "status" | "sns";

type Props = {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  selectedSubTypes: Set<CampaignSubType>;
  onToggleSns: (snsType: CampaignSubType) => void;
  onClearSns: () => void;
};

export function ApplicationFilters({
  statusFilter,
  onStatusChange,
  selectedSubTypes,
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
    selectedSubTypes.has(option.value),
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
            selectedSubTypes.size > 0 ? styles.chipActive : ""
          }`}
          onClick={() => openPopover("sns", snsButtonRef.current)}
        >
          {selectedSubTypes.size > 0
            ? `${t("application.filters.snsChipPrefix")}: ${selectedSnsLabel}`
            : t("application.filters.snsChipEmpty")}
          {selectedSubTypes.size > 0 && (
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
            ? `${t("application.filters.statusChipPrefix")}: ${STATUS_LABEL[statusFilter]}`
            : t("application.filters.statusChipEmpty")}
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
                <div className={styles.popoverTitle}>{t("application.filters.popoverStatusTitle")}</div>
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
                <div className={styles.popoverTitle}>{t("application.filters.popoverSnsTitle")}</div>
                <div className={styles.popoverItems}>
                  {VISIBLE_SNS_OPTIONS.map((option) => {
                    const selected = selectedSubTypes.has(option.value);
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
                    {t("application.filters.popoverClose")}
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
