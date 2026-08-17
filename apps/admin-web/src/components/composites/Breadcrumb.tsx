import { useLocation } from "react-router-dom";
import { findNavMatch } from "@/lib/navigation";
import { useT } from "@/lib/i18n";
import styles from "./Breadcrumb.module.css";

export function Breadcrumb() {
  const t = useT();
  const { pathname } = useLocation();
  const match = findNavMatch(pathname);

  if (!match) return <div className={styles.root} />;

  return (
    <div className={styles.root}>
      <span>{t(match.group.title)}</span>
      <span className={styles.sep}>›</span>
      <span>{t(match.item.label)}</span>
    </div>
  );
}
