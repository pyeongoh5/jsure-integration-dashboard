import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNoticeDetail } from "@/domains/notice";
import { useMarkNoticeRead } from "@/domains/notice";
import { t } from "@i18n";
import styles from "./Notices.module.css";

function formatDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

export function NoticeDetail() {
  const params = useParams<{ id?: string }>();
  const { notice, loading, error } = useNoticeDetail(params.id);
  const markRead = useMarkNoticeRead();

  useEffect(() => {
    if (notice) markRead(notice.id);
  }, [notice, markRead]);

  if (loading) {
    return <div className={styles.pageState}>{t("pages.notices.loading")}</div>;
  }
  if (error || !notice) {
    return (
      <div className={styles.pageState}>
        {error ?? t("pages.notices.detailNotFound")}
      </div>
    );
  }

  return (
    <div className={styles.detail}>
      <div className={styles.detailCard}>
        <div className={styles.detailHeader}>
          <h1 className={styles.detailTitle}>{notice.title}</h1>
          <div className={styles.detailDate}>{formatDate(notice.startAt)}</div>
        </div>
        <div
          className={styles.detailBody}
          dangerouslySetInnerHTML={{ __html: notice.contentHtml }}
        />
      </div>
    </div>
  );
}
