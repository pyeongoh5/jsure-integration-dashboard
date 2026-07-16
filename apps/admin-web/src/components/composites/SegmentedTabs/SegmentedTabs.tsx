import styles from "./SegmentedTabs.module.css";

type Props<Key extends string> = {
  items: { key: Key; label: string }[];
  value: Key;
  onChange: (key: Key) => void;
  className?: string;
};

/** 세그먼트 컨트롤 형태의 탭. 메시지 템플릿 페이지의 카테고리 탭 스타일을 공용화. */
export function SegmentedTabs<Key extends string>({
  items,
  value,
  onChange,
  className,
}: Props<Key>) {
  return (
    <div
      className={[styles.tabs, className].filter(Boolean).join(" ")}
      role="tablist"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={item.key === value}
          className={`${styles.tab} ${item.key === value ? styles.tabActive : ""}`}
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
