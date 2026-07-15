import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./FilterChip.module.css";

type OpenState = {
  id: string;
  anchor: HTMLButtonElement;
};

type ChipBarContextValue = {
  openId: string | null;
  toggle: (id: string, anchor: HTMLButtonElement) => void;
  close: () => void;
  registerRef: (id: string, ref: HTMLButtonElement | null) => void;
};

const ChipBarContext = createContext<ChipBarContextValue | null>(null);

function useChipBar(): ChipBarContextValue {
  const ctx = useContext(ChipBarContext);
  if (!ctx) throw new Error("FilterChip must be used inside FilterChipBar");
  return ctx;
}

export function FilterChipBar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenState | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const registerRef = useCallback(
    (id: string, ref: HTMLButtonElement | null) => {
      if (ref) refs.current.set(id, ref);
      else refs.current.delete(id);
    },
    [],
  );

  const toggle = useCallback(
    (id: string, anchor: HTMLButtonElement) => {
      setOpen((prev) => (prev?.id === id ? null : { id, anchor }));
    },
    [],
  );

  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      for (const btn of refs.current.values()) {
        if (btn.contains(target)) return;
      }
      // popover check is delegated to child via stopPropagation on popover root
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const value = useMemo<ChipBarContextValue>(
    () => ({ openId: open?.id ?? null, toggle, close, registerRef }),
    [open, toggle, close, registerRef],
  );

  return (
    <ChipBarContext.Provider value={value}>
      <div className={styles.bar}>{children}</div>
    </ChipBarContext.Provider>
  );
}

type FilterChipProps = {
  /** 활성 상태의 chip 표시 텍스트. null 이면 비활성(placeholder). */
  activeLabel: string | null;
  /** 비활성 상태의 placeholder. 예: "+ 카테고리". */
  emptyLabel: string;
  /** 활성 상태일 때 ✕ 로 초기화. undefined 이면 ✕ 버튼 안 나옴. */
  onClear?: () => void;
  /** 팝오버 콘텐츠 렌더. close() 로 팝오버 닫기. */
  renderPopover: (close: () => void) => ReactNode;
  /** 팝오버 상단 라벨. */
  popoverTitle?: string;
};

export function FilterChip({
  activeLabel,
  emptyLabel,
  onClear,
  renderPopover,
  popoverTitle,
}: FilterChipProps) {
  const bar = useChipBar();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const active = activeLabel !== null;
  const isOpen = bar.openId === id;

  useEffect(() => {
    bar.registerRef(id, buttonRef.current);
    return () => bar.registerRef(id, null);
  }, [id, bar]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      setRect(buttonRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.filter} ${active ? styles.filterActive : ""}`}
        onClick={() => {
          if (buttonRef.current) bar.toggle(id, buttonRef.current);
        }}
      >
        {active ? activeLabel : emptyLabel}
        {active && onClear && (
          <span
            className={styles.clearButton}
            onClick={(event) => {
              event.stopPropagation();
              onClear();
              bar.close();
            }}
          >
            {" "}
            ✕
          </span>
        )}
      </button>
      {isOpen && rect &&
        createPortal(
          <div
            ref={popoverRef}
            className={styles.popover}
            style={{ top: rect.bottom + 6, left: rect.left }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {popoverTitle && <div className={styles.popoverTitle}>{popoverTitle}</div>}
            {renderPopover(bar.close)}
          </div>,
          document.body,
        )}
    </>
  );
}

type Option<T extends string> = { key: T; label: string };

type SingleSelectFilterChipProps<T extends string> = {
  emptyLabel: string;
  /** 활성 라벨 접두. 예: "카테고리" → "카테고리: SNS". 없으면 label 만 표시. */
  labelPrefix?: string;
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  popoverTitle?: string;
  /** 초기화 허용 여부. 기본 true. */
  clearable?: boolean;
};

/**
 * 단일 선택 chip. 옵션 리스트 팝오버를 자동으로 렌더.
 */
export function SingleSelectFilterChip<T extends string>({
  emptyLabel,
  labelPrefix,
  options,
  value,
  onChange,
  popoverTitle,
  clearable = true,
}: SingleSelectFilterChipProps<T>) {
  const selected = value !== null ? options.find((option) => option.key === value) : null;
  const activeLabel = selected
    ? labelPrefix
      ? `${labelPrefix}: ${selected.label}`
      : selected.label
    : null;

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel={emptyLabel}
      onClear={clearable ? () => onChange(null) : undefined}
      popoverTitle={popoverTitle}
      renderPopover={(close) => (
        <div className={styles.popoverItems}>
          {options.map((option) => {
            const on = option.key === value;
            return (
              <button
                key={option.key}
                type="button"
                className={`${styles.popoverOption}${on ? ` ${styles.popoverOptionOn}` : ""}`}
                onClick={() => {
                  onChange(option.key);
                  close();
                }}
              >
                <span className={styles.popoverOptionLabel}>{option.label}</span>
                {on && <i className={`fa-solid fa-check ${styles.popoverOptionCheck}`} />}
              </button>
            );
          })}
        </div>
      )}
    />
  );
}
