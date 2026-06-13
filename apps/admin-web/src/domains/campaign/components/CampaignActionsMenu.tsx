import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./CampaignActionsMenu.module.css";

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;

type Props = {
  anchor: { x: number; y: number };
  onApplicants: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDismiss: () => void;
};

export function CampaignActionsMenu({
  anchor,
  onApplicants,
  onEdit,
  onClose,
  onDismiss,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: anchor.x,
    top: anchor.y + MENU_GAP,
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.x;
    let top = anchor.y + MENU_GAP;
    if (left + rect.width > vw - VIEWPORT_PADDING) {
      left = Math.max(VIEWPORT_PADDING, vw - rect.width - VIEWPORT_PADDING);
    }
    if (top + rect.height > vh - VIEWPORT_PADDING) {
      top = Math.max(VIEWPORT_PADDING, anchor.y - rect.height - MENU_GAP);
    }
    setPos({ left, top });
  }, [anchor.x, anchor.y]);

  useEffect(() => {
    const onDocPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onDocPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onDismiss]);

  return createPortal(
    <div
      ref={ref}
      className={styles.root}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={onApplicants}
      >
        응모자 관리
      </button>
      <button
        type="button"
        role="menuitem"
        className={styles.item}
        onClick={onEdit}
      >
        캠페인 수정
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${styles.item} ${styles.itemDanger}`}
        onClick={onClose}
      >
        캠페인 종료
      </button>
    </div>,
    document.body,
  );
}
