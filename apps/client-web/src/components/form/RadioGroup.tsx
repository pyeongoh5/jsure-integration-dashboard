import "./RadioGroup.css";

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
    <div className="rg">
      {label && <div className="rg__label">{label}</div>}
      <div className="rg__row">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`rg__opt ${value === opt.value ? "rg__opt--on" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <div className="rg__error">{error}</div>}
    </div>
  );
}
