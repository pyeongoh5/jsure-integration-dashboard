import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  formatTitleWithTags,
  type CampaignCategory,
  type CampaignStage,
  type DailyActionAlertKind,
} from "@jsure/shared";
import {
  FilterChipBar,
  SingleSelectFilterChip,
} from "@/components/composites/FilterChip";
import { CATEGORY_FILTER_OPTIONS } from "@/domains/application";
import { getStoredUser } from "@/domains/auth";
import {
  CampaignBoardTable,
  DailyActionAlerts,
  DailyAlertRemindDialog,
  StagePipelineBar,
  getCampaignBoard,
  getDailyActionAlerts,
  overviewBoardStyles,
} from "@/domains/overview";
import { useT } from "@/lib/i18n";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { foldForSearch } from "@/lib/searchText";
import styles from "./Overview.module.css";

const EMPTY_STAGE_COUNTS: Record<CampaignStage, number> = {
  OPEN_PENDING: 0,
  IN_PROGRESS: 0,
  INSIGHT_COLLECTING: 0,
  SETTLEMENT_PENDING: 0,
};

const EMPTY_ALERT_COUNTS = {
  postOverdueCount: 0,
  deliveryUnconfirmedCount: 0,
  withdrawalPendingCount: 0,
};

export function Overview() {
  const t = useT();
  const user = getStoredUser();
  const [stageFilter, setStageFilter] = useState<CampaignStage | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CampaignCategory | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [alertKind, setAlertKind] = useState<DailyActionAlertKind | null>(null);
  const [boardPage, setBoardPage] = useState(0);

  // 필터를 바꾸면 목록이 통째로 달라지므로 항상 첫 페이지부터 보여 준다.
  useEffect(() => {
    setBoardPage(0);
  }, [stageFilter, categoryFilter, debouncedQuery]);

  const boardQuery = useQuery({
    queryKey: ["admin", "overview", "campaign-board"],
    queryFn: getCampaignBoard,
    staleTime: 30_000,
  });
  const alertsQuery = useQuery({
    queryKey: ["admin", "overview", "daily-alerts"],
    queryFn: getDailyActionAlerts,
    staleTime: 30_000,
  });

  // 단계 카운터는 카테고리·검색까지 반영한 뒤의 집계다 — 카운터를 눌러 테이블이
  // 걸러졌을 때 숫자와 행 수가 어긋나지 않도록.
  const scopedRows = useMemo(() => {
    const rows = boardQuery.data?.rows ?? [];
    const folded = foldForSearch(debouncedQuery.trim());
    return rows.filter((row) => {
      if (categoryFilter !== null && row.category !== categoryFilter) return false;
      if (
        folded &&
        !foldForSearch(formatTitleWithTags(row.tags, row.title)).includes(folded)
      ) {
        return false;
      }
      return true;
    });
  }, [boardQuery.data, categoryFilter, debouncedQuery]);

  const stageCounts = useMemo(() => {
    const counts = { ...EMPTY_STAGE_COUNTS };
    for (const row of scopedRows) counts[row.stage] += 1;
    return counts;
  }, [scopedRows]);

  const visibleRows = useMemo(
    () =>
      stageFilter === null
        ? scopedRows
        : scopedRows.filter((row) => row.stage === stageFilter),
    [scopedRows, stageFilter],
  );

  return (
    <div className={styles.ov}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t("pages.overview.greeting", { name: user?.name ?? "" })}{" "}
          <span className={styles.wave}>👋</span>
        </h1>
        <p className={styles.subtitle}>{t("pages.overview.subtitle")}</p>
      </div>

      <StagePipelineBar
        counts={stageCounts}
        selected={stageFilter}
        onSelect={setStageFilter}
      />

      <DailyActionAlerts
        counts={alertsQuery.data ?? EMPTY_ALERT_COUNTS}
        onOpenTargets={setAlertKind}
        withdrawalTo="/influencers?withdrawal=PENDING"
      />

      <section className={overviewBoardStyles.boardCard}>
        <header className={overviewBoardStyles.boardHead}>
          <h2 className={overviewBoardStyles.boardTitle}>
            {t("pages.overview.board.title")}
          </h2>
          <div className={overviewBoardStyles.boardTools}>
            <FilterChipBar>
              <SingleSelectFilterChip
                emptyLabel={t(
                  "domains.application.applicants.categoryFilter.chipEmpty",
                )}
                labelPrefix={t(
                  "domains.application.applicants.categoryFilter.prefix",
                )}
                popoverTitle={t(
                  "domains.application.applicants.categoryFilter.title",
                )}
                options={CATEGORY_FILTER_OPTIONS.map((option) => ({
                  key: option.key,
                  label: t(option.label),
                }))}
                value={categoryFilter}
                onChange={setCategoryFilter}
              />
            </FilterChipBar>
            <div className={overviewBoardStyles.search}>
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="text"
                placeholder={t("pages.overview.board.searchPlaceholder")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>
        </header>

        {boardQuery.isPending && (
          <div className={overviewBoardStyles.empty}>{t("common.loading")}</div>
        )}
        {boardQuery.isError && (
          <div className={overviewBoardStyles.empty}>
            {t("pages.overview.loadFailed")}
          </div>
        )}
        {boardQuery.isSuccess && (
          <CampaignBoardTable
            rows={visibleRows}
            page={boardPage}
            onPageChange={setBoardPage}
          />
        )}
      </section>

      {alertKind && (
        <DailyAlertRemindDialog
          kind={alertKind}
          onClose={() => setAlertKind(null)}
          onSent={() => alertsQuery.refetch()}
        />
      )}
    </div>
  );
}
