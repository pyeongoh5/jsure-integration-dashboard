import type { AdminTranslationKey } from "@i18n/admin";
import type { NoticeRow } from "./noticeTransform";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
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

const STATUS_LABEL: Record<NoticeRow["status"], AdminTranslationKey> = {
  active: "domains.notice.table.statusActive",
  scheduled: "domains.notice.table.statusScheduled",
  expired: "domains.notice.table.statusExpired",
};

export function NoticeTable({ rows, pendingId, onEdit, onDelete }: Props) {
  const t = useT();
  if (rows.length === 0) {
    return <div className={styles.empty}>{t("domains.notice.table.empty")}</div>;
  }
  return (
    <ScrollTable>
      <table className={styles.root}>
        <thead>
        <tr>
          <th>{t("domains.notice.table.headerTitle")}</th>
          <th style={{ width: 120 }}>{t("domains.notice.table.headerStatus")}</th>
          <th style={{ width: 170 }}>{t("domains.notice.table.headerStartAt")}</th>
          <th style={{ width: 170 }}>{t("domains.notice.table.headerEndAt")}</th>
          <th style={{ width: 120 }}>{t("domains.notice.table.headerAuthor")}</th>
          <th style={{ width: 160 }} aria-label={t("domains.notice.table.actionsAria")} />
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
                {t(STATUS_LABEL[notice.status])}
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
                <Button variant="secondary" size="sm" onClick={() => onEdit(notice.id)}>
                  {t("domains.notice.table.edit")}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pendingId === notice.id}
                  onClick={() => onDelete(notice.id)}
                >
                  {t("domains.notice.table.delete")}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
      </table>
    </ScrollTable>
  );
}
