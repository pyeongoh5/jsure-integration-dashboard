import styles from "./RadioGroup.module.css";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  value: T | null;
  options: ReadonlyArray<Option<T>>;
  onChange: (v: T) => void;
  error?: string;
}

export function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
}: Props<T>) {
  return (
    <div className={styles.root}>
      {label && <div className={styles.label}>{label}</div>}
      <div className={styles.row}>
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.opt} ${value === opt.value ? styles.optOn : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
