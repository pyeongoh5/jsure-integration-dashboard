import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./Dialog.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** false 면 배경(바깥) 클릭으로 닫히지 않는다 — 입력 중 실수 방지용. 기본 true. */
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  closeOnBackdrop = true,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={[styles.dialog, className ?? ""].filter(Boolean).join(" ")}
      onClose={onClose}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === ref.current) onClose();
      }}
    >
      {title && <header className={styles.header}>{title}</header>}
      <div className={styles.body}>{children}</div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </dialog>
  );
}
