import { Link } from "react-router-dom";
import { useNoticesData } from "@/domains/notice";
import { useReadNoticeIds } from "@/domains/notice";
import { t } from "@i18n";
import styles from "./Notices.module.css";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function Notices() {
  const { notices, loading, error } = useNoticesData();
  const readIds = useReadNoticeIds();
  const readSet = new Set(readIds);

  return (
    <div className={styles.page}>
      <div className={styles.pageTitle}>{t("pages.notices.title")}</div>

      {loading ? (
        <div className={styles.pageState}>불러오는 중…</div>
      ) : error ? (
        <div className={styles.pageState}>{error}</div>
      ) : notices.length === 0 ? (
        <div className={styles.pageState}>공지사항이 없습니다</div>
      ) : (
        notices.map((notice) => (
          <Link
            key={notice.id}
            to={`/notices/${encodeURIComponent(notice.id)}`}
            className={styles.listItem}
          >
            <div className={styles.listItemTitle}>{notice.title}</div>
            <div className={styles.listItemDate}>
              {formatDate(notice.startAt)}
            </div>
            {!readSet.has(notice.id) ? (
              <span className={styles.listItemDot} aria-label="신규" />
            ) : null}
          </Link>
        ))
      )}
    </div>
  );
}
