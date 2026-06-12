import styles from "./Spinner.module.css";

type Size = "sm" | "md" | "lg";

interface Props {
  size?: Size;
  "aria-label"?: string;
  className?: string;
}

export function Spinner({
  size = "md",
  className,
  "aria-label": ariaLabel = "Loading",
}: Props) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={[styles.spinner, styles[size], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
