import { useState } from "react";
import { JwinStatusBadge } from "@/components/composites/JwinStatusBadge";
import { ScrollTable } from "@/components/composites";
import { IconButton } from "@/components/ui";
import type { AdminBrandCampaignListItem } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { JwinBrandCampaignDeleteDialog } from "./JwinBrandCampaignDeleteDialog";
import styles from "./JwinCampaignTable.module.css";

type Props = {
  rows: AdminBrandCampaignListItem[];
  onRowClick: (brandCampaignId: string) => void;
  /** 참여 삭제 후 시즌 상세를 다시 읽는다 */
  onChanged: () => void;
};

/** 시즌 상세의 참여 브랜드 표. 행을 누르면 그 참여의 편집 화면으로 간다. */
export function JwinBrandCampaignTable({ rows, onRowClick, onChanged }: Props) {
  const t = useT();
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandCampaignListItem | null>(null);

  if (rows.length === 0) {
    return <div className={styles.empty}>{t("jwin.campaign.brands.empty")}</div>;
  }

  return (
    <>
      <ScrollTable minWidth={720}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("jwin.campaign.columns.brand")}</th>
              <th>{t("jwin.campaign.columns.status")}</th>
              <th>{t("jwin.campaign.columns.account")}</th>
              <th className={styles.num}>{t("jwin.campaign.columns.entries")}</th>
              <th>{t("jwin.campaign.columns.warnings")}</th>
              <th className={styles.num}>{t("jwin.campaign.columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={styles.row} onClick={() => onRowClick(row.id)}>
                <td className={styles.brand}>{row.brandName}</td>
                <td>
                  <JwinStatusBadge status={row.status} />
                </td>
                <td className={row.xUsername ? styles.mono : styles.muted}>
                  {row.xUsername ? `@${row.xUsername}` : t("jwin.campaign.notConnected")}
                </td>
                <td className={styles.num}>{row.entryCount}</td>
                <td>
                  <div className={styles.warnings}>
                    {row.needsReconnect && (
                      <span className={styles.warning}>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                        {t("jwin.campaign.warning.reconnect", { count: 1 })}
                      </span>
                    )}
                    {row.failedPostCount > 0 && (
                      <span className={styles.warning}>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                        {t("jwin.campaign.warning.failedPosts", { count: row.failedPostCount })}
                      </span>
                    )}
                    {!row.needsReconnect && row.failedPostCount === 0 && (
                      <span className={styles.muted}>{t("jwin.common.dash")}</span>
                    )}
                  </div>
                </td>
                <td className={styles.num}>
                  {/* 행 클릭(편집 이동)과 겹치지 않도록 이벤트 전파를 끊는다. */}
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("jwin.campaign.delete")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(row);
                    }}
                  >
                    <i className="fa-solid fa-trash" aria-hidden="true" />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>

      {deleteTarget && (
        <JwinBrandCampaignDeleteDialog
          brandCampaignId={deleteTarget.id}
          brandName={deleteTarget.brandName}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}
