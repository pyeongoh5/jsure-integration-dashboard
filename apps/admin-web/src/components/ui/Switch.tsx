import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import styles from "./Switch.module.css";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  ariaLabel?: string;
}

export const Switch = forwardRef<HTMLInputElement, Props>(function Switch(
  { checked, onChange, disabled, className, ariaLabel, ...rest },
  ref,
) {
  return (
    <label
      className={[styles.wrap, className ?? "", disabled ? styles.disabled : ""]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-checked={checked}
        className={styles.input}
        {...rest}
      />
      <span className={styles.track} />
    </label>
  );
});
