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
  const setAt = (i: number, v: string) => {
    const next = value.slice();
    next[i] = v;
    onChange(next);
  };
  const removeAt = (i: number) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const add = () => {
    if (value.length >= max) return;
    onChange([...value, ""]);
  };
  return (
    <div className="cf__urls">
      {value.map((url, i) => (
        <div key={i} className="cf__url-row">
          <input
            type="url"
            className="cf__input"
            placeholder="https://..."
            value={url}
            disabled={disabled}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <button
            type="button"
            className="cf__btn cf__btn--ghost"
            onClick={() => removeAt(i)}
            disabled={disabled}
            aria-label={`항목 ${i + 1} 삭제`}
          >
            삭제
          </button>
          {errorByIndex?.[i] && (
            <div className="cf__error">{errorByIndex[i]}</div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="cf__btn cf__btn--ghost"
        onClick={add}
        disabled={disabled || value.length >= max}
      >
        URL 추가 ({value.length}/{max})
      </button>
    </div>
  );
}
