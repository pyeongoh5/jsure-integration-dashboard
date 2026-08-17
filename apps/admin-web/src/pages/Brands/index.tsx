import { useT } from "@/lib/i18n";
import styles from "../_shared/Placeholder.module.css";

export function Brands() {
  const t = useT();
  return (
    <div className={styles.root}>
      <h1 className={styles.title}>{t("pages.brands.title")}</h1>
      <p className={styles.subtitle}>{t("pages.brands.subtitle")}</p>
    </div>
  );
}
