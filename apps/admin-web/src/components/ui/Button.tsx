import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "success";
export type ButtonSize = "sm" | "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    block = false,
    disabled,
    className,
    iconLeft,
    iconRight,
    children,
    type = "button",
    ...rest
  },
  ref,
) {
  const classes = buttonClassNames({
    variant,
    size,
    block,
    loading,
    className,
  });

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      className={classes}
      {...rest}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

/** Link 등 다른 엘리먼트도 동일한 스타일을 쓸 수 있도록 공유. */
export function buttonClassNames({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  className?: string;
}): string {
  return [
    styles.button,
    styles[variant],
    styles[size],
    block ? styles.block : "",
    loading ? styles.loading : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}
