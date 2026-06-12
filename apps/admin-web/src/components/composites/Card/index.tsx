import type { ReactNode } from "react";
import styles from "./Card.module.css";

type CardProps = {
  title?: ReactNode;
  content?: ReactNode;
  bottomAffix?: ReactNode;
};

export function Card({ title, content, bottomAffix }: CardProps) {
  return (
    <div className={`${styles.root} ui-card`}>
      {title !== undefined && <div className={styles.title}>{title}</div>}
      {content !== undefined && <div className={styles.content}>{content}</div>}
      {bottomAffix !== undefined && <div className={styles.bottomAffix}>{bottomAffix}</div>}
    </div>
  );
}
