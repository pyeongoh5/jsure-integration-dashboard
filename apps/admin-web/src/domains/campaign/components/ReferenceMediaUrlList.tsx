import styles from "./CampaignForm.module.css";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  disabled?: boolean;
  errorByIndex?: Record<number, string | undefined>;
};

export function ReferenceMediaUrlList({
  value,
  onChange,
  max = 10,
  disabled,
  errorByIndex,
}: Props) {
  const setAt = (index: number, url: string) => {
    const next = value.slice();
    next[index] = url;
    onChange(next);
  };
  const removeAt = (index: number) => {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
  };
  return (
    <div className={styles.urls}>
      {value.map((url, index) => (
        <div key={index} className={styles.urlRow}>
          <input
            type="url"
            className={styles.input}
            placeholder="https://..."
            value={url}
            disabled={disabled}
            onChange={(event) => setAt(index, event.target.value)}
          />
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => removeAt(index)}
            disabled={disabled}
            aria-label={`항목 ${index + 1} 삭제`}
          >
            삭제
          </button>
          {errorByIndex?.[index] && (
            <div className={styles.error}>{errorByIndex[index]}</div>
          )}
        </div>
      ))}
      <button
        type="button"
        className={`${styles.btn} ${styles.btnGhost}`}
        onClick={add}
        disabled={disabled || value.length >= max}
      >
        URL 추가 ({value.length}/{max})
      </button>
    </div>
  );
}
