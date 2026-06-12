import { useLocation } from "react-router-dom";
import { findNavMatch } from "@/lib/navigation";
import styles from "./Breadcrumb.module.css";

export function Breadcrumb() {
  const { pathname } = useLocation();
  const match = findNavMatch(pathname);

  if (!match) return <div className={styles.root} />;

  return (
    <div className={styles.root}>
      <span>{match.group.title}</span>
      <span className={styles.sep}>›</span>
      <span>{match.item.label}</span>
    </div>
  );
}
