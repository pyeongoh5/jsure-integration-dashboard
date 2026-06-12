import { forwardRef } from "react";
import type { SelectHTMLAttributes, ReactNode } from "react";
import styles from "./Select.module.css";

interface Option {
  value: string;
  label: string;
}

interface Props
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "children"> {
  value?: string;
  onChange?: (value: string) => void;
  options?: Option[];
  placeholder?: string;
  error?: boolean;
  children?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { value, onChange, options, placeholder, error = false, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={[styles.select, error ? styles.error : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
});
