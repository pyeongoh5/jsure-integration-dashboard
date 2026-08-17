import { useT } from "@/lib/i18n";
import styles from "./Spinner.module.css";

type Size = "sm" | "md" | "lg";

interface Props {
  size?: Size;
  "aria-label"?: string;
  className?: string;
}

export function Spinner({ size = "md", className, "aria-label": ariaLabel }: Props) {
  const t = useT();
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? t("components.spinner.loading")}
      className={[styles.spinner, styles[size], className ?? ""]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
