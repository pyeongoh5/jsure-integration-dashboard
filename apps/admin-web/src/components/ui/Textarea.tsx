import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import styles from "./Textarea.module.css";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { value, onChange, error = false, className, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      rows={rows}
      className={[styles.textarea, error ? styles.error : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
});
