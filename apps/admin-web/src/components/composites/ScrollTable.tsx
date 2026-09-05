import type { ReactNode } from "react";
import styles from "./ScrollTable.module.css";

type Props = {
  minWidth?: number;
  children: ReactNode;
};

export function ScrollTable({ minWidth = 1024, children }: Props) {
  return (
    // data 속성은 무한 스크롤 감시자가 IntersectionObserver 의 root 로 찾아 쓴다.
    <div className={styles.scroll} data-scroll-root>
      <div className={styles.inner} style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}
