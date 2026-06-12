import type { ReactNode } from "react";
import { useFormContext, useController } from "react-hook-form";
import styles from "./FormField.module.css";

interface FieldRenderProps {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  error: boolean;
  "aria-invalid": boolean;
  ref: (instance: unknown) => void;
}

interface Props {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: (field: FieldRenderProps) => ReactNode;
}

export function FormField({ name, label, hint, required, children }: Props) {
  const { control } = useFormContext();
  const { field, fieldState, formState } = useController({ name, control });
  const showError =
    (formState.isSubmitted || fieldState.isTouched) && !!fieldState.error;
  const id = `ff-${name.replace(/\./g, "-")}`;
  const errorMessage = fieldState.error?.message;
  const value = typeof field.value === "string" ? field.value : "";

  return (
    <label htmlFor={id} className={styles.field}>
      {label && (
        <span className={styles.label}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </span>
      )}
      {children({
        id,
        name: field.name,
        value,
        onChange: field.onChange,
        onBlur: field.onBlur,
        error: showError,
        "aria-invalid": showError,
        ref: field.ref,
      })}
      {showError && (
        <span className={styles.error}>
          {typeof errorMessage === "string" && errorMessage.length > 0
            ? errorMessage
            : "入力内容を確認してください"}
        </span>
      )}
      {!showError && hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}
