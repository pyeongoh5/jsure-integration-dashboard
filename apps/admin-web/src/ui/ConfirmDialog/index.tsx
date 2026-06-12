import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ConfirmDialog.css";

type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  subtitle?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  /** 입력 미충족 등으로 확인 버튼만 비활성화. 취소 버튼/Escape/배경 클릭에는 영향 없음. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  subtitle,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="ui-confirm__backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="ui-confirm__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-title"
      >
        <h2 id="ui-confirm-title" className="ui-confirm__title">
          {title}
        </h2>
        {subtitle !== undefined && (
          <p className="ui-confirm__subtitle">{subtitle}</p>
        )}
        <div className="ui-confirm__actions">
          <button
            type="button"
            className="ui-confirm__btn ui-confirm__btn--cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`ui-confirm__btn ui-confirm__btn--confirm ${
              tone === "danger" ? "ui-confirm__btn--danger" : ""
            }`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
