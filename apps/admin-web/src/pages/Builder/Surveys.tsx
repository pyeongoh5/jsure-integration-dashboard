import { useT } from "@/lib/i18n";
import styles from "./Builder.module.css";

export function BuilderSurveys() {
  const t = useT();

  return (
    <div className={styles.root}>
      <div className={styles.title}>{t("pages.builderSurveys.title")}</div>
      <div className={styles.empty}>{t("pages.builderSurveys.empty")}</div>
    </div>
  );
}
