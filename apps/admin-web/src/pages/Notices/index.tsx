import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NoticeTable, NoticeDeleteDialog, useNoticesData, useNoticeMutations, toNoticeRow } from "@/domains/notice";
import { buttonClassNames } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./Notices.module.css";

export function Notices() {
  const t = useT();
  const navigate = useNavigate();
  const { notices, loading, error, reload } = useNoticesData();
  const { remove, pendingId } = useNoticeMutations({ onMutated: reload });
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const rows = useMemo(() => notices.map((notice) => toNoticeRow(notice)), [notices]);

  function handleDelete(id: string) {
    const target = notices.find((notice) => notice.id === id);
    if (!target) return;
    setDeleteTarget({ id: target.id, title: target.title });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ok = await remove(deleteTarget.id);
    if (ok) setDeleteTarget(null);
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>{t("nav.items.notices")}</div>
        <Link
          to="/notices/new"
          className={buttonClassNames({ variant: "primary", size: "md" })}
        >
          {t("pages.notices.newNotice")}
        </Link>
      </div>

      <div className={styles.card}>
        {loading ? (
          <div className={styles.state}>{t("common.loading")}</div>
        ) : error ? (
          <div className={styles.state}>{error}</div>
        ) : (
          <NoticeTable
            rows={rows}
            pendingId={pendingId}
            onEdit={(id) => navigate(`/notices/${encodeURIComponent(id)}/edit`)}
            onDelete={handleDelete}
          />
        )}
      </div>

      <NoticeDeleteDialog
        open={deleteTarget !== null}
        title={deleteTarget?.title ?? ""}
        busy={pendingId === deleteTarget?.id}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
