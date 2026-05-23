import { useEffect, useRef } from "react";
import "./CampaignActionsMenu.css";

type Props = {
  onApplicants: () => void;
  onEdit: () => void;
  onClose: () => void;
  onDismiss: () => void;
};

export function CampaignActionsMenu({ onApplicants, onEdit, onClose, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={ref} className="cam-menu" role="menu" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        role="menuitem"
        className="cam-menu__item"
        onClick={onApplicants}
      >
        응모자 관리
      </button>
      <button
        type="button"
        role="menuitem"
        className="cam-menu__item"
        onClick={onEdit}
      >
        캠페인 수정
      </button>
      <button
        type="button"
        role="menuitem"
        className="cam-menu__item cam-menu__item--danger"
        onClick={onClose}
      >
        캠페인 종료
      </button>
    </div>
  );
}
