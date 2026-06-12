import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SnsType } from "@jsure/shared";
import type { StatusFilter } from "../filter";
import "./ApplicationFilters.css";

const STATUS_OPTIONS: { value: Exclude<StatusFilter, "all">; label: string }[] =
  [
    { value: "applied", label: "申請" },
    { value: "rejected", label: "却下" },
    { value: "in_progress", label: "進行中" },
    { value: "ended", label: "終了" },
  ];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "",
  applied: "申請",
  rejected: "却下",
  in_progress: "進行中",
  ended: "終了",
};

const SNS_OPTIONS: { value: SnsType; label: string }[] = [
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "X", label: "X" },
  { value: "YOUTUBE", label: "YouTube" },
];

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

  const selectedSnsLabel = SNS_OPTIONS.filter((option) =>
    selectedSnsTypes.has(option.value),
  )
    .map((option) => option.label)
    .join(", ");

  return (
    <>
      <div className="appf">
        <button
          ref={snsButtonRef}
          type="button"
          className={`appf__chip ${
            selectedSnsTypes.size > 0 ? "appf__chip--active" : ""
          }`}
          onClick={() => openPopover("sns", snsButtonRef.current)}
        >
          {selectedSnsTypes.size > 0 ? `SNS: ${selectedSnsLabel}` : "+ SNS"}
          {selectedSnsTypes.size > 0 && (
            <span
              className="appf__clear"
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
          className={`appf__chip ${
            statusFilter !== "all" ? "appf__chip--active" : ""
          }`}
          onClick={() => openPopover("status", statusButtonRef.current)}
        >
          {statusFilter !== "all"
            ? `状態: ${STATUS_LABEL[statusFilter]}`
            : "+ 状態"}
          {statusFilter !== "all" && (
            <span
              className="appf__clear"
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
            className="appf-popover"
            style={{ top: popover.rect.bottom + 6, left: popover.rect.left }}
          >
            {popover.kind === "status" ? (
              <>
                <div className="appf-popover__title">状態を選択</div>
                <div className="appf-popover__items">
                  {STATUS_OPTIONS.map((option) => {
                    const selected = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`appf-popover__option${
                          selected ? " appf-popover__option--on" : ""
                        }`}
                        onClick={() => {
                          onStatusChange(option.value);
                          setPopover(null);
                        }}
                      >
                        <span>{option.label}</span>
                        {selected && (
                          <span className="appf-popover__check">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="appf-popover__title">SNSを選択（複数可）</div>
                <div className="appf-popover__items">
                  {SNS_OPTIONS.map((option) => {
                    const selected = selectedSnsTypes.has(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`appf-popover__option${
                          selected ? " appf-popover__option--on" : ""
                        }`}
                        onClick={() => onToggleSns(option.value)}
                      >
                        <span>{option.label}</span>
                        {selected && (
                          <span className="appf-popover__check">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="appf-popover__actions">
                  <button
                    type="button"
                    className="appf-popover__close"
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
