import styles from "./FilterChips.module.css";

type FilterOption<K extends string> = { key: K; label: string };

type FilterChipsProps<K extends string> = {
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
};

export function FilterChips<K extends string>({
  options,
  value,
  onChange,
}: FilterChipsProps<K>) {
  return (
    <div className={styles.root}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          className={`${styles.chip} ${
            value === option.key ? styles.chipActive : ""
          }`}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
