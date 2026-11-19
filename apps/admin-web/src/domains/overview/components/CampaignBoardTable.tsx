import { Link } from "react-router-dom";
import { formatTitleWithTags, type CampaignBoardRow } from "@jsure/shared";
import { CampaignStageBadge, ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import { CATEGORY_LABEL_KO } from "@/domains/application";
import { useT } from "@/lib/i18n";
import styles from "./OverviewBoard.module.css";

const PAGE_SIZE = 15;

type Props = {
  /** 필터까지 적용된 전체 행. 페이지 자르기는 이 컴포넌트가 한다. */
  rows: CampaignBoardRow[];
  page: number;
  onPageChange: (page: number) => void;
};

export function CampaignBoardTable({ rows, page, onPageChange }: Props) {
  const t = useT();

  if (rows.length === 0) {
    return <div className={styles.empty}>{t("pages.overview.board.empty")}</div>;
  }

  // 필터로 행이 줄어 현재 페이지가 사라졌을 때를 대비해 범위 안으로 당긴다.
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <>
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
            {pageRows.map((row) => (
              <tr key={row.campaignId}>
                <td>
                  <div className={styles.campaignTitle}>
                    {formatTitleWithTags(row.tags, row.title)}
                  </div>
                  <div className={styles.campaignMeta}>{t(CATEGORY_LABEL_KO[row.category])}</div>
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

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
          >
            {t("common.previous")}
          </Button>
          <span className={styles.pageStatus}>
            {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
          >
            {t("common.next")}
          </Button>
        </div>
      )}
    </>
  );
}
