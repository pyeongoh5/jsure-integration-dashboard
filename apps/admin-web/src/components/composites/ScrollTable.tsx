import type { ReactNode } from "react";
import styles from "./ScrollTable.module.css";

type Props = {
  minWidth?: number;
  children: ReactNode;
};

export function ScrollTable({ minWidth = 1024, children }: Props) {
  return (
    <div className={styles.scroll}>
      <div className={styles.inner} style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}
