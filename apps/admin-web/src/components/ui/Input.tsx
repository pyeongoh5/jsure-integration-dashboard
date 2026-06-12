import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./Input.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { value, onChange, error = false, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={[styles.input, error ? styles.error : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
});
