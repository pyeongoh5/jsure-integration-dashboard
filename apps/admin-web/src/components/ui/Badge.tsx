import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Tone = "neutral" | "ok" | "warn" | "danger" | "primary";
type Size = "sm" | "md";

interface Props {
  tone?: Tone;
  size?: Size;
  children: ReactNode;
  className?: string;
}

export function Badge({
  tone = "neutral",
  size = "sm",
  children,
  className,
}: Props) {
  const classes = [styles.badge, styles[tone], styles[size], className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{children}</span>;
}
