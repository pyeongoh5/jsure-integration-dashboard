import type { ReactNode } from "react";
import {
  useFormContext,
  useController,
  type FieldValues,
  type FieldPath,
  type FieldPathValue,
} from "react-hook-form";
import styles from "./FormField.module.css";

interface FieldRenderProps<TValue> {
  id: string;
  name: string;
  value: TValue;
  onChange: (value: TValue) => void;
  onBlur: () => void;
  error: boolean;
  "aria-invalid": boolean;
  ref: (instance: unknown) => void;
}

interface Props<TFieldValues extends FieldValues, TName extends FieldPath<TFieldValues>> {
  name: TName;
  label?: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: (field: FieldRenderProps<FieldPathValue<TFieldValues, TName>>) => ReactNode;
}

export function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ name, label, hint, required, children }: Props<TFieldValues, TName>) {
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState, formState } = useController<TFieldValues, TName>({ name, control });
  const showError = (formState.isSubmitted || fieldState.isTouched) && !!fieldState.error;
  const id = `ff-${String(name).replace(/\./g, "-")}`;
  const errorMessage = fieldState.error?.message;

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
        value: field.value as FieldPathValue<TFieldValues, TName>,
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
