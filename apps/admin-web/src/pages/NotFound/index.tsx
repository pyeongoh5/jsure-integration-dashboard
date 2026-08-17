import { Link } from "react-router-dom";
import { buttonClassNames } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./NotFound.module.css";

export function NotFound() {
  const t = useT();
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.code}>404</div>
        <h1 className={styles.title}>{t("pages.notFound.title")}</h1>
        <p className={styles.subtitle}>{t("pages.notFound.subtitle")}</p>
        <div className={styles.actions}>
          <Link to="/" className={buttonClassNames({ variant: "primary", size: "md" })}>
            {t("pages.notFound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
