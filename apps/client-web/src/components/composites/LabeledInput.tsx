import styles from "./LabeledInput.module.css";

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
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input
        className={[styles.input, error && styles.error]
          .filter(Boolean)
          .join(" ")}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && !error && <span className={styles.hint}>{hint}</span>}
      {error && <span className={styles.errorText}>{error}</span>}
    </label>
  );
}
