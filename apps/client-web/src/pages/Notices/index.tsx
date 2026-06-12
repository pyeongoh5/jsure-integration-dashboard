import { Link } from "react-router-dom";
import { useNoticesData } from "@/domains/notice";
import { useReadNoticeIds } from "@/domains/notice";
import "./Notices.css";

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
    <div className="notices-page">
      <div className="notices-page__title">お知らせ</div>

      {loading ? (
        <div className="notices-page__state">불러오는 중…</div>
      ) : error ? (
        <div className="notices-page__state">{error}</div>
      ) : notices.length === 0 ? (
        <div className="notices-page__state">공지사항이 없습니다</div>
      ) : (
        notices.map((notice) => (
          <Link
            key={notice.id}
            to={`/notices/${encodeURIComponent(notice.id)}`}
            className="notice-list-item"
          >
            <div className="notice-list-item__title">{notice.title}</div>
            <div className="notice-list-item__date">
              {formatDate(notice.startAt)}
            </div>
            {!readSet.has(notice.id) ? (
              <span className="notice-list-item__dot" aria-label="신규" />
            ) : null}
          </Link>
        ))
      )}
    </div>
  );
}
