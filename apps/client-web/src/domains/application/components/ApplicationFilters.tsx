import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CampaignCategory } from "@jsure/shared";
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


const CATEGORY_OPTIONS: { value: CampaignCategory; label: string }[] = [
  { value: "SNS", label: t("campaign.category.sns") },
  { value: "FAKE_PURCHASE", label: t("campaign.category.fakePurchase") },
  { value: "SIMPLE_REVIEW", label: t("campaign.category.simpleReview") },
];

type PopoverKind = "status" | "category";

type Props = {
  statusFilter: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  selectedCategories: Set<CampaignCategory>;
  onToggleCategory: (category: CampaignCategory) => void;
  onClearCategories: () => void;
};

export function ApplicationFilters({
  statusFilter,
  onStatusChange,
  selectedCategories,
  onToggleCategory,
  onClearCategories,
}: Props) {
  const [popover, setPopover] = useState<{
    kind: PopoverKind;
    rect: DOMRect;
  } | null>(null);
  const statusButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (statusButtonRef.current?.contains(target)) return;
      if (categoryButtonRef.current?.contains(target)) return;
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

  const selectedCategoryLabel = CATEGORY_OPTIONS.filter((option) =>
    selectedCategories.has(option.value),
  )
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <div className={styles.bar}>
        <button
          ref={categoryButtonRef}
          type="button"
          className={`${styles.chip} ${
            selectedCategories.size > 0 ? styles.chipActive : ""
          }`}
          onClick={() => openPopover("category", categoryButtonRef.current)}
        >
          {selectedCategories.size > 0
            ? `${t("application.filters.categoryChipPrefix")}: ${selectedCategoryLabel}`
            : t("application.filters.categoryChipEmpty")}
          {selectedCategories.size > 0 && (
            <span
              className={styles.clear}
              onClick={(event) => {
                event.stopPropagation();
                onClearCategories();
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
                <div className={styles.popoverTitle}>{t("application.filters.popoverCategoryTitle")}</div>
                <div className={styles.popoverItems}>
                  {CATEGORY_OPTIONS.map((option) => {
                    const selected = selectedCategories.has(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.popoverOption}${
                          selected ? ` ${styles.popoverOptionOn}` : ""
                        }`}
                        onClick={() => onToggleCategory(option.value)}
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
