import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./PrimaryButton.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  children: ReactNode;
}

export function PrimaryButton({
  variant = "primary",
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`pb pb--${variant} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
