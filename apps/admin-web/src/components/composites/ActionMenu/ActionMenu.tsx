import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "@/components/ui";
import styles from "./ActionMenu.module.css";

const MENU_GAP = 4;
const VIEWPORT_PADDING = 8;

export type ActionMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  /** 되돌리기 어려운 액션 — 빨갛게 그린다. */
  danger?: boolean;
};

type Props = {
  items: ActionMenuItem[];
  /** 아이콘 버튼의 스크린리더 라벨. */
  ariaLabel: string;
};

/**
 * 덜 쓰는 행 액션을 접어두는 "더보기" 팝오버.
 *
 * 메뉴는 포털로 body 에 fixed 로 띄운다 — 표가 가로 스크롤(ScrollTable) 안에 있어
 * 셀에 absolute 로 두면 overflow 에 잘린다. 동작·생김새는 캠페인 목록의
 * CampaignActionsMenu 를 따른다(그쪽은 2뎁스 서브메뉴가 있어 따로 둔다).
 */
export function ActionMenu({ items, ariaLabel }: Props) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  // 열린 뒤 실제 크기를 재서 화면 밖으로 나가면 끌어들인다.
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!anchor || !element) return;
    const rect = element.getBoundingClientRect();
    let left = anchor.x - rect.width;
    let top = anchor.y + MENU_GAP;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (top + rect.height > window.innerHeight - VIEWPORT_PADDING) {
      top = Math.max(VIEWPORT_PADDING, anchor.y - rect.height - MENU_GAP);
    }
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // fixed 라 스크롤되면 위치가 어긋난다 — 따라다니게 하느니 닫는다.
    // 캡처 단계로 들어야 표 내부 스크롤도 잡힌다.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchor]);

  if (items.length === 0) return null;

  return (
    <>
      <IconButton
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        size="sm"
        variant="secondary"
        onClick={(event) => {
          if (anchor) {
            setAnchor(null);
            return;
          }
          const box = event.currentTarget.getBoundingClientRect();
          // 버튼 오른쪽 끝에 메뉴 오른쪽을 맞춘다 — 액션 칸이 표 오른쪽 끝이라
          // 왼쪽으로 펼쳐야 화면 밖으로 안 나간다.
          setAnchor({ x: box.right, y: box.bottom });
        }}
      >
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </IconButton>

      {anchor !== null &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.root}
            role="menu"
            style={{ left: pos.left, top: pos.top }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`${styles.item} ${item.danger ? styles.itemDanger : ""}`}
                onClick={() => {
                  setAnchor(null);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
