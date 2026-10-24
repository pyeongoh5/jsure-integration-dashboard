import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./ConfirmDialog.module.css";

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
  /** 확인/취소 외의 보조 액션. 액션 줄 왼쪽 끝에 붙는다. */
  secondaryAction?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  subtitle,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  busy = false,
  confirmDisabled = false,
  secondaryAction,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useT();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-confirm-title"
      >
        <h2 id="ui-confirm-title" className={styles.title}>
          {title}
        </h2>
        {subtitle !== undefined && (
          <p className={styles.subtitle}>{subtitle}</p>
        )}
        <div className={styles.actions}>
          {secondaryAction !== undefined && (
            <div className={styles.secondaryAction}>{secondaryAction}</div>
          )}
          <Button
            variant="secondary"
            size="md"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel ?? t("common.cancel")}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            loading={busy}
          >
            {busy
              ? t("components.confirmDialog.processing")
              : (confirmLabel ?? t("components.confirmDialog.confirm"))}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
