import { JwinStatusBadge } from "@/components/composites/JwinStatusBadge";
import { ScrollTable } from "@/components/composites";
import type { JwinCampaignRow } from "./jwinCampaignTransform";
import styles from "./JwinCampaignTable.module.css";

type Props = {
  rows: JwinCampaignRow[];
  onRowClick: (id: string) => void;
};

export function JwinCampaignTable({ rows, onRowClick }: Props) {
  if (rows.length === 0) {
    return <div className={styles.empty}>등록된 캠페인이 없습니다.</div>;
  }

  return (
    <ScrollTable minWidth={880}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>브랜드</th>
            <th>slug</th>
            <th>상태</th>
            <th>기간 (JST)</th>
            <th>연동 계정</th>
            <th className={styles.num}>응모</th>
            <th>경고</th>
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
              <td className={row.account === "미연동" ? styles.muted : styles.mono}>
                {row.account}
              </td>
              <td className={styles.num}>{row.entryCount}</td>
              <td>
                {row.warnings.length === 0 ? (
                  <span className={styles.muted}>—</span>
                ) : (
                  <div className={styles.warnings}>
                    {row.warnings.map((warning) => (
                      <span key={warning.kind} className={styles.warning}>
                        <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
                        {warning.label}
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
