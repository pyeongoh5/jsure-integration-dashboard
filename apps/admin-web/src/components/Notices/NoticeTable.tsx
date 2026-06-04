import type { NoticeRow } from "./noticeTransform";
import "./NoticeTable.css";

type Props = {
  rows: NoticeRow[];
  pendingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function NoticeTable({ rows, pendingId, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return <div className="notice-table__empty">등록된 공지사항이 없습니다</div>;
  }
  return (
    <table className="notice-table">
      <thead>
        <tr>
          <th>제목</th>
          <th style={{ width: 120 }}>상태</th>
          <th style={{ width: 180 }}>게시일</th>
          <th style={{ width: 120 }}>작성자</th>
          <th style={{ width: 160 }} aria-label="작업" />
        </tr>
      </thead>
      <tbody>
        {rows.map((notice) => (
          <tr key={notice.id} onClick={() => onEdit(notice.id)}>
            <td>{notice.title}</td>
            <td>
              <span
                className={`notice-table__status notice-table__status--${notice.status}`}
              >
                {notice.status === "scheduled" ? "예약" : "게시됨"}
              </span>
            </td>
            <td>{notice.publishedAtLabel}</td>
            <td>{notice.authorName}</td>
            <td>
              <div
                className="notice-table__actions"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="notice-table__btn"
                  onClick={() => onEdit(notice.id)}
                >
                  편집
                </button>
                <button
                  type="button"
                  className="notice-table__btn notice-table__btn--danger"
                  disabled={pendingId === notice.id}
                  onClick={() => onDelete(notice.id)}
                >
                  삭제
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
