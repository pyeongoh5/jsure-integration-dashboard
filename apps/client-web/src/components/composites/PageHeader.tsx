import { useNavigate } from "react-router-dom";
import { t } from "@i18n";
import styles from "./PageHeader.module.css";

interface Props {
  title?: string;
  showBack?: boolean;
  right?: React.ReactNode;
}

export function PageHeader({ title, showBack, right }: Props) {
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      <div className={styles.left}>
        {showBack && (
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate(-1)}
            aria-label={t("components.pageHeader.backAriaLabel")}
          >
            <i className="fa-solid fa-chevron-left" />
          </button>
        )}
      </div>
      <div className={styles.title}>{title}</div>
      <div className={styles.right}>{right}</div>
    </header>
  );
}
