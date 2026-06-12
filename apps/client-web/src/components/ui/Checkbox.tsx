import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Checkbox.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { checked, onChange, label, className, disabled, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange?.(e.target.checked)}
      disabled={disabled}
      className={styles.input}
      {...rest}
    />
  );
  if (!label) {
    return (
      <span
        className={[styles.wrap, className ?? ""].filter(Boolean).join(" ")}
      >
        {input}
      </span>
    );
  }
  return (
    <label
      className={[styles.wrap, styles.withLabel, className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {input}
      <span className={styles.label}>{label}</span>
    </label>
  );
});
