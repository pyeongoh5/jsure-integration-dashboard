import "./LabeledInput.css";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "tel" | "password" | "number";
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "numeric" | "decimal";
  autoComplete?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
}

export function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  inputMode,
  autoComplete,
  error,
  hint,
  maxLength,
}: Props) {
  return (
    <label className="li">
      <span className="li__label">{label}</span>
      <input
        className={`li__input ${error ? "li__input--error" : ""}`}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && !error && <span className="li__hint">{hint}</span>}
      {error && <span className="li__error">{error}</span>}
    </label>
  );
}
