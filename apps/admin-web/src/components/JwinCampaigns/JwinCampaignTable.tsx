import { JwinStatusBadge } from "@/components/composites/JwinStatusBadge";
import { ScrollTable } from "@/components/composites";
import { useT } from "@/lib/i18n";
import type { JwinCampaignRow } from "./jwinCampaignTransform";
import styles from "./JwinCampaignTable.module.css";

type Props = {
  rows: JwinCampaignRow[];
  onRowClick: (id: string) => void;
};

export function JwinCampaignTable({ rows, onRowClick }: Props) {
  const t = useT();

  if (rows.length === 0) {
    return <div className={styles.empty}>{t("jwin.campaign.empty")}</div>;
  }

  return (
    <ScrollTable minWidth={880}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("jwin.campaign.columns.brand")}</th>
            <th>{t("jwin.campaign.columns.slug")}</th>
            <th>{t("jwin.campaign.columns.status")}</th>
            <th>{t("jwin.campaign.columns.period")}</th>
            <th>{t("jwin.campaign.columns.account")}</th>
            <th className={styles.num}>{t("jwin.campaign.columns.entries")}</th>
            <th>{t("jwin.campaign.columns.warnings")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={styles.row} onClick={() => onRowClick(row.id)}>
              <td className={styles.brand}>{row.brandName}</td>
              <td className={styles.mono}>{row.slug}</td>
              <td>
                <JwinStatusBadge status={row.status} />
              </td>
              <td className={styles.mono}>{row.period}</td>
              <td className={row.xUsername ? styles.mono : styles.muted}>
                {row.xUsername ? `@${row.xUsername}` : t("jwin.campaign.notConnected")}
              </td>
              <td className={styles.num}>{row.entryCount}</td>
              <td>
                {row.warnings.length === 0 ? (
                  <span className={styles.muted}>{t("jwin.common.dash")}</span>
                ) : (
                  <div className={styles.warnings}>
                    {row.warnings.map((warning) => (
                      <span key={warning.kind} className={styles.warning}>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                        {t(warning.labelKey, warning.labelParams)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
