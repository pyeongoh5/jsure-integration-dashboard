import { Link } from "react-router-dom";
import { formatTitleWithTags, type CampaignBoardRow } from "@jsure/shared";
import { CampaignStageBadge, ScrollTable } from "@/components/composites";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { useT } from "@/lib/i18n";
import styles from "./OverviewBoard.module.css";

type Props = {
  rows: CampaignBoardRow[];
};

export function CampaignBoardTable({ rows }: Props) {
  const t = useT();

  if (rows.length === 0) {
    return <div className={styles.empty}>{t("pages.overview.board.empty")}</div>;
  }

  return (
    <ScrollTable minWidth={900}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t("pages.overview.board.columns.campaign")}</th>
            <th>{t("pages.overview.board.columns.stage")}</th>
            <th>{t("pages.overview.board.columns.progress")}</th>
            <th>{t("pages.overview.board.columns.urgentIssue")}</th>
            <th>{t("pages.overview.board.columns.quickLinks")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.campaignId}>
              <td>
                <div className={styles.campaignTitle}>
                  {formatTitleWithTags(row.tags, row.title)}
                </div>
                <div className={styles.campaignMeta}>
                  {t(CATEGORY_LABEL_KO[row.category])}
                </div>
              </td>
              <td>
                <CampaignStageBadge stage={row.stage} />
              </td>
              {/* 진척도·긴급 이슈는 기능 정의 전이라 빈 컬럼으로 둔다. */}
              <td className={styles.placeholderCell}>—</td>
              <td className={styles.placeholderCell}>—</td>
              <td>
                <div className={styles.quickLinks}>
                  <Link
                    className={styles.quickLink}
                    to={`/campaigns/${encodeURIComponent(row.campaignId)}/edit`}
                  >
                    {t("pages.overview.board.goManage")}
                  </Link>
                  <Link
                    className={styles.quickLink}
                    to={`/applicants?campaignId=${encodeURIComponent(row.campaignId)}`}
                  >
                    {t("pages.overview.board.goApplicants")}
                  </Link>
                  <Link
                    className={styles.quickLink}
                    to={`/drafts?campaignId=${encodeURIComponent(row.campaignId)}`}
                  >
                    {t("pages.overview.board.goReview")}
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollTable>
  );
}
