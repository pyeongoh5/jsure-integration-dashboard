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
import { buildMultiSelectLabel } from "./buildMultiSelectLabel";
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
  /** 활성 상태일 때 칩 버튼에 거는 네이티브 title(호버 툴팁). 생략하면 안 건다. */
  activeTitle?: string;
};

export function FilterChip({
  activeLabel,
  emptyLabel,
  onClear,
  renderPopover,
  popoverTitle,
  activeTitle,
}: FilterChipProps) {
  const bar = useChipBar();
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  // 라벨이 말줄임으로 잘렸을 때만 툴팁을 띄운다 — hover 시점에 한 번 측정한다.
  const [labelTruncated, setLabelTruncated] = useState(false);

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
        title={active ? activeTitle : undefined}
        onClick={() => {
          if (buttonRef.current) bar.toggle(id, buttonRef.current);
        }}
        onMouseEnter={() => {
          const label = labelRef.current;
          setLabelTruncated(!!label && label.scrollWidth > label.clientWidth);
        }}
        onMouseLeave={() => setLabelTruncated(false)}
      >
        <span ref={labelRef} className={styles.filterLabel}>
          {active ? activeLabel : emptyLabel}
        </span>
        {active && labelTruncated && (
          <span className={styles.labelTooltip} role="tooltip">
            {activeLabel}
          </span>
        )}
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
            // 칩 아래로만 펼치므로 남은 뷰포트 높이가 곧 상한이다. 이걸 안 걸면
            // 옵션이 많은 칩(태그 등)이 화면 밖으로 흘러 스크롤도 못 한다.
            style={{
              top: rect.bottom + 6,
              left: rect.left,
              maxHeight: `calc(100vh - ${rect.bottom + 6}px - 12px)`,
            }}
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

type Option<T extends string> = { key: T; label: string; icon?: string };

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
                {option.icon && (
                  <i className={`${option.icon} ${styles.popoverOptionIcon}`} />
                )}
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

type MultiSelectFilterChipProps<T extends string> = {
  emptyLabel: string;
  /** 활성 라벨 접두. 예: "상태" → "상태: A, B". 없으면 선택 라벨만. */
  labelPrefix?: string;
  options: readonly Option<T>[];
  value: Set<T>;
  onChange: (value: Set<T>) => void;
  popoverTitle?: string;
  /** 넘기면 활성 라벨을 이 개수만큼만 보이고 나머지는 "+M" 으로 접는다. 생략하면 안 접는다. */
  maxVisibleLabels?: number;
};

/**
 * 다중 선택 chip. 옵션을 토글하며(선택해도 팝오버 유지), ✕ 로 전체 해제.
 */
export function MultiSelectFilterChip<T extends string>({
  emptyLabel,
  labelPrefix,
  options,
  value,
  onChange,
  popoverTitle,
  maxVisibleLabels,
}: MultiSelectFilterChipProps<T>) {
  const selectedLabels = options
    .filter((option) => value.has(option.key))
    .map((option) => option.label);
  const { text: selectedLabelText, title: selectedLabelTitle } =
    buildMultiSelectLabel(selectedLabels, maxVisibleLabels);
  const withLabelPrefix = (label: string) =>
    labelPrefix ? `${labelPrefix}: ${label}` : label;
  const activeLabel = selectedLabels.length > 0 ? withLabelPrefix(selectedLabelText) : null;
  // 접힌 경우(텍스트가 "+N" 으로 줄어든 경우)에만 title 을 건다 — 안 접히면 보이는
  // 글자와 title 이 같아 툴팁이 무의미하고, 기존 6개 호출부에 없던 호버 동작만 생긴다.
  const activeTitle =
    selectedLabels.length > 0 && selectedLabelText !== selectedLabelTitle
      ? withLabelPrefix(selectedLabelTitle)
      : undefined;

  const toggle = (key: T) => {
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel={emptyLabel}
      onClear={() => onChange(new Set())}
      popoverTitle={popoverTitle}
      activeTitle={activeTitle}
      renderPopover={() => (
        <div className={styles.popoverItems}>
          {options.map((option) => {
            const on = value.has(option.key);
            return (
              <button
                key={option.key}
                type="button"
                className={`${styles.popoverOption}${on ? ` ${styles.popoverOptionOn}` : ""}`}
                onClick={() => toggle(option.key)}
              >
                {option.icon && (
                  <i className={`${option.icon} ${styles.popoverOptionIcon}`} />
                )}
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
