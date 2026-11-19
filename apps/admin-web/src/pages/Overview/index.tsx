import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  CampaignBoardFilterSchema,
  type CampaignBoardFilter,
  type CampaignCategory,
  type CampaignStage,
  type CampaignStageCounts,
  type DailyActionAlertKind,
} from "@jsure/shared";
import { FilterChipBar, SingleSelectFilterChip } from "@/components/composites/FilterChip";
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
import styles from "./Overview.module.css";

const EMPTY_STAGE_COUNTS: CampaignStageCounts = {
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
  const [categoryFilter, setCategoryFilter] = useState<CampaignCategory | null>(null);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [alertKind, setAlertKind] = useState<DailyActionAlertKind | null>(null);
  const [page, setPage] = useState(0);

  // 필터를 바꾸면 목록이 통째로 달라지므로 항상 첫 페이지부터 보여 준다.
  const changeFilter = (apply: () => void) => {
    setPage(0);
    apply();
  };

  const boardFilter = useMemo<CampaignBoardFilter>(
    () =>
      CampaignBoardFilterSchema.parse({
        stage: stageFilter,
        category: categoryFilter,
        query: debouncedQuery.trim(),
        page,
      }),
    [stageFilter, categoryFilter, debouncedQuery, page],
  );

  const boardQuery = useQuery({
    queryKey: ["admin", "overview", "campaign-board", boardFilter],
    queryFn: () => getCampaignBoard(boardFilter),
    staleTime: 30_000,
    // 페이지를 넘길 때 표가 빈 화면으로 깜빡이지 않도록 이전 페이지를 남겨 둔다.
    placeholderData: keepPreviousData,
  });
  const alertsQuery = useQuery({
    queryKey: ["admin", "overview", "daily-alerts"],
    queryFn: getDailyActionAlerts,
    staleTime: 30_000,
  });

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
        counts={boardQuery.data?.stageCounts ?? EMPTY_STAGE_COUNTS}
        selected={stageFilter}
        onSelect={(stage) => changeFilter(() => setStageFilter(stage))}
      />

      <DailyActionAlerts
        counts={alertsQuery.data ?? EMPTY_ALERT_COUNTS}
        onOpenTargets={setAlertKind}
        withdrawalTo="/influencers?withdrawal=PENDING"
      />

      <section className={overviewBoardStyles.boardCard}>
        <header className={overviewBoardStyles.boardHead}>
          <h2 className={overviewBoardStyles.boardTitle}>{t("pages.overview.board.title")}</h2>
          <div className={overviewBoardStyles.boardTools}>
            <FilterChipBar>
              <SingleSelectFilterChip
                emptyLabel={t("domains.application.applicants.categoryFilter.chipEmpty")}
                labelPrefix={t("domains.application.applicants.categoryFilter.prefix")}
                popoverTitle={t("domains.application.applicants.categoryFilter.title")}
                options={CATEGORY_FILTER_OPTIONS.map((option) => ({
                  key: option.key,
                  label: t(option.label),
                }))}
                value={categoryFilter}
                onChange={(category) => changeFilter(() => setCategoryFilter(category))}
              />
            </FilterChipBar>
            <div className={overviewBoardStyles.search}>
              <i className="fa-solid fa-magnifying-glass" />
              <input
                type="text"
                placeholder={t("pages.overview.board.searchPlaceholder")}
                value={query}
                onChange={(event) => changeFilter(() => setQuery(event.target.value))}
              />
            </div>
          </div>
        </header>

        {boardQuery.isPending && (
          <div className={overviewBoardStyles.empty}>{t("common.loading")}</div>
        )}
        {boardQuery.isError && (
          <div className={overviewBoardStyles.empty}>{t("pages.overview.loadFailed")}</div>
        )}
        {boardQuery.data && (
          <CampaignBoardTable
            rows={boardQuery.data.rows}
            total={boardQuery.data.total}
            page={page}
            onPageChange={setPage}
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
