import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./Radio.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onChange?: () => void;
  label?: ReactNode;
}

export const Radio = forwardRef<HTMLInputElement, Props>(function Radio(
  { checked, onChange, label, className, disabled, name, value, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      type="radio"
      checked={checked}
      name={name}
      value={value}
      onChange={() => onChange?.()}
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
