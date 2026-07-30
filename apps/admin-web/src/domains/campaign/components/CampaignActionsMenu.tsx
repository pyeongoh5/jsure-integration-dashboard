import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CampaignStatus } from "../types";
import styles from "./CampaignActionsMenu.module.css";

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;

type Props = {
  anchor: { x: number; y: number };
  /** 액션 노출 조건의 단일 소스(서버가 계산한 파생 상태). */
  status: CampaignStatus;
  onApplicants: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onViewApproved: () => void;
  onClose: () => void;
  onHide: () => void;
  onUnhide: () => void;
  onDelete: () => void;
  onDismiss: () => void;
};

export function CampaignActionsMenu({
  anchor,
  status,
  onApplicants,
  onEdit,
  onCopy,
  onViewApproved,
  onClose,
  onHide,
  onUnhide,
  onDelete,
  onDismiss,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const submenuRef = useRef<HTMLDivElement | null>(null);
  // 임시저장 캠페인은 응모/승인 항목이 없어 캠페인 관리 하위만 쓴다 → 처음부터 펼친다.
  const [manageOpen, setManageOpen] = useState(status === "draft");
  // 오른쪽 공간이 부족하면 서브메뉴를 왼쪽으로 뒤집는다.
  const [flipLeft, setFlipLeft] = useState(false);
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

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    const root = ref.current;
    if (!submenu || !root) return;
    const rootRight = root.getBoundingClientRect().right;
    setFlipLeft(
      rootRight + submenu.offsetWidth > window.innerWidth - VIEWPORT_PADDING,
    );
  }, [manageOpen, pos.left]);

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

  const isDraft = status === "draft";
  const isHidden = status === "hidden";
  // 발행된 캠페인의 종료·비공개는 상태와 무관하게 항상 같은 자리에 노출하고(항목이
  // 빠지면 순서가 흔들려 오조작을 유발한다), 조건 미충족 시 모달에서 이유를 안내한다.
  // 임시저장은 종료·비공개 대상이 아니므로 수정·복사·삭제만 둔다.

  return createPortal(
    <div
      ref={ref}
      className={styles.root}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => e.stopPropagation()}
    >
      {!isDraft && (
        <>
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
            onClick={onViewApproved}
          >
            승인자 명단 보기
          </button>
        </>
      )}
      <div
        className={styles.manageWrap}
        onMouseEnter={() => setManageOpen(true)}
        onMouseLeave={() => setManageOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={manageOpen}
          className={`${styles.item} ${styles.itemToggle}`}
          onClick={() => setManageOpen((open) => !open)}
        >
          캠페인 관리
          <i className={`fa-solid fa-chevron-right ${styles.chevron}`} />
        </button>
        {manageOpen && (
          <div
            ref={submenuRef}
            className={`${styles.submenu} ${flipLeft ? styles.submenuLeft : ""}`}
            role="menu"
          >
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
              className={styles.item}
              onClick={onCopy}
            >
              캠페인 복사
            </button>
            {!isDraft &&
              (isHidden ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={onUnhide}
                >
                  캠페인 공개
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.item}
                  onClick={onHide}
                >
                  캠페인 비공개
                </button>
              ))}
            {!isDraft && (
              <button
                type="button"
                role="menuitem"
                className={`${styles.item} ${styles.itemDanger}`}
                onClick={onClose}
              >
                캠페인 종료
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={`${styles.item} ${styles.itemDanger}`}
              onClick={onDelete}
            >
              캠페인 삭제
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
