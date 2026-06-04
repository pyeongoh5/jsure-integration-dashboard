import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useNoticeDetail } from "../../components/Notices/useNoticeDetail";
import { useMarkNoticeRead } from "../../components/Notices/useReadNotices";
import "./Notices.css";

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
    return <div className="notices-page__state">불러오는 중…</div>;
  }
  if (error || !notice) {
    return <div className="notices-page__state">{error ?? "공지를 찾을 수 없습니다"}</div>;
  }

  return (
    <div className="notice-detail">
      <div className="notice-detail__card">
        <div className="notice-detail__header">
          <h1 className="notice-detail__title">{notice.title}</h1>
          <div className="notice-detail__date">{formatDate(notice.startAt)}</div>
        </div>
        <div
          className="notice-detail__body"
          dangerouslySetInnerHTML={{ __html: notice.contentHtml }}
        />
      </div>
    </div>
  );
}
