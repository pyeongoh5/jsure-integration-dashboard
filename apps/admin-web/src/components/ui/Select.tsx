import type { SelectHTMLAttributes } from "react";
import styles from "./Select.module.css";

type Option = {
  value: string;
  label: string;
};

interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}

export function Select({ value, onChange, options, placeholder, className, ...rest }: Props) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={[styles.select, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
