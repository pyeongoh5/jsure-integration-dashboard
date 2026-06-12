import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NoticeTable, NoticeDeleteDialog, useNoticesData, useNoticeMutations, toNoticeRow } from "@/domains/notice";
import "./Notices.css";

export function Notices() {
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
    <div className="notices">
      <div className="notices__header">
        <div className="notices__title">공지사항</div>
        <Link to="/notices/new" className="notices__new-btn">
          새 공지 작성
        </Link>
      </div>

      <div className="notices__card">
        {loading ? (
          <div className="notices__state">불러오는 중…</div>
        ) : error ? (
          <div className="notices__state">{error}</div>
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
