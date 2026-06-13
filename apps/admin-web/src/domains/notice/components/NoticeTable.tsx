import type { NoticeRow } from "./noticeTransform";
import { ScrollTable } from "@/components/composites";
import styles from "./NoticeTable.module.css";

type Props = {
  rows: NoticeRow[];
  pendingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

const STATUS_CLASS: Record<NoticeRow["status"], string | undefined> = {
  active: styles.statusActive,
  scheduled: styles.statusScheduled,
  expired: styles.statusExpired,
};

export function NoticeTable({ rows, pendingId, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return <div className={styles.empty}>등록된 공지사항이 없습니다</div>;
  }
  return (
    <ScrollTable>
      <table className={styles.root}>
        <thead>
        <tr>
          <th>제목</th>
          <th style={{ width: 120 }}>상태</th>
          <th style={{ width: 170 }}>게시 시작일</th>
          <th style={{ width: 170 }}>게시 종료일</th>
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
                className={`${styles.status} ${STATUS_CLASS[notice.status] ?? ""}`}
              >
                {notice.status === "scheduled"
                  ? "예약"
                  : notice.status === "expired"
                    ? "종료"
                    : "게시 중"}
              </span>
            </td>
            <td>{notice.startAtLabel}</td>
            <td>{notice.endAtLabel}</td>
            <td>{notice.authorName}</td>
            <td>
              <div
                className={styles.actions}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => onEdit(notice.id)}
                >
                  편집
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
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
    </ScrollTable>
  );
}
