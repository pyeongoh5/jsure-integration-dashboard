import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  SUB_TYPE_LABEL,
  pickRepresentativeSnsAccount,
  postUrls,
  type AdminSettlement,
  type CampaignCategory,
} from "@jsure/shared";
import { translate, type AdminLanguage, type AdminTranslationKey } from "@i18n/admin";
import { getStoredLanguage, useLanguage, useT } from "@/lib/i18n";
import {
  completeSettlements,
  listSettlements,
  useSubmissionDetail,
  ApplicationHistoryDialog,
  CampaignFilterChip,
  CATEGORY_LABEL_KO,
  CATEGORY_FILTER_OPTIONS,
  type HistoryTarget,
} from "@/domains/application";
import { ScrollTable, SnsHandleCell } from "@/components/composites";
import { FilterChipBar } from "@/components/composites/FilterChip";
import { Button } from "@/components/ui";
import styles from "./Payouts.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminSettlement[] }
  | { kind: "error"; message: string };

function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateTime(iso: string | null, language: AdminLanguage): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRefund(amount: number): string {
  return amount === 0 ? "—" : `¥${amount.toLocaleString("ja-JP")}`;
}

// 투고/인사이트는 응모 단위 일괄 제출이라 서브타입별로 다르지 않음 — 가장 늦은 시각 하나로 대표.
function latestDate(values: (string | null)[]): string | null {
  const submitted = values.filter((value): value is string => value !== null);
  return submitted.length === 0 ? null : submitted.sort()[submitted.length - 1]!;
}

type SettlementSnsAccount = AdminSettlement["influencer"]["snsAccounts"][number];

/** 응모 서브타입과 일치하는 SNS 계정. 가구매·단순리뷰 응모는 일치하는 계정이 없다. */
function appliedSnsAccount(row: AdminSettlement): SettlementSnsAccount | null {
  const appliedSubTypes = row.posts.map((post) => post.subType);
  return (
    row.influencer.snsAccounts.find((account) =>
      appliedSubTypes.includes(account.snsType),
    ) ?? null
  );
}

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const CATEGORY_CODE: Record<CampaignCategory, string> = {
  SNS: "SNS",
  FAKE_PURCHASE: "Q10",
  SIMPLE_REVIEW: "REV",
};

// 파일 내 그룹 키. 형식: YYMM-<카테고리코드>-NNN (예 2607-SNS-001).
// 순번은 카테고리별로 001부터, 시트에 나오는 정산 행 순서로 부여.
export function buildSettlementGroupIds(
  rows: AdminSettlement[],
  month: string,
): string[] {
  const yymm = month.slice(2, 4) + month.slice(5, 7);
  const counters = new Map<string, number>();
  return rows.map((row) => {
    const code = CATEGORY_CODE[row.campaign.category];
    const next = (counters.get(code) ?? 0) + 1;
    counters.set(code, next);
    return `${yymm}-${code}-${String(next).padStart(3, "0")}`;
  });
}

const BANK_COUNTRY_LABEL_KEY: Record<"JP" | "KR", AdminTranslationKey> = {
  JP: "domains.influencer.csv.countryJp",
  KR: "domains.influencer.csv.countryKr",
};

function metricCell(value: number | null): string {
  return value === null ? "" : String(value);
}

// 검토 페이지(DraftTable)의 보기 버튼 라벨과 동일 규칙.
function submissionViewLabelKey(row: AdminSettlement): AdminTranslationKey {
  if (row.campaign.category !== "SNS") return "domains.application.drafts.table.viewResult";
  const insightSubmitted =
    row.posts.length > 0 &&
    row.posts.every((post) => post.insightSubmittedAt !== null);
  return insightSubmitted
    ? "domains.application.drafts.table.viewInsight"
    : "domains.application.drafts.table.viewSubmission";
}

const CSV_HEADER_KEYS: AdminTranslationKey[] = [
  "pages.payouts.csv.groupId",
  "domains.application.applicants.table.influencer",
  "pages.payouts.columns.snsId",
  "domains.application.applicants.table.campaign",
  "domains.application.applicants.table.category",
  "domains.application.export.sns",
  "pages.payouts.csv.submittedUrl",
  "pages.payouts.columns.postPublishedAt",
  "pages.payouts.columns.insightSubmittedAt",
  "domains.report.metrics.likes",
  "domains.report.metrics.comments",
  "domains.report.metrics.shares",
  "domains.report.metrics.reposts",
  "domains.report.metrics.saves",
  "domains.report.metrics.views",
  "pages.payouts.csv.reach",
  "pages.payouts.bank.country",
  "pages.payouts.bank.bankName",
  "pages.payouts.bank.bankCode",
  "pages.payouts.bank.branchName",
  "pages.payouts.bank.branchCode",
  "pages.payouts.bank.accountNumber",
  "pages.payouts.bank.accountHolder",
  "pages.payouts.bank.invoiceNumber",
  "pages.payouts.csv.rewardJpy",
  "pages.payouts.csv.refundJpy",
  "pages.payouts.csv.totalJpy",
  "pages.payouts.columns.registeredAt",
  "pages.payouts.columns.completedAt",
  "common.status",
];

// 응모자 관리 CSV 와 동일하게 핸들만(bare) 내보낸다. 채널 구분은 SNS 컬럼이 담당.
function snsCsvHandle(row: AdminSettlement): string {
  const account =
    appliedSnsAccount(row) ?? pickRepresentativeSnsAccount(row.influencer.snsAccounts);
  return account?.handle ?? "";
}

function downloadCsv(rows: AdminSettlement[], month: string): void {
  const language = getStoredLanguage();
  const headers = CSV_HEADER_KEYS.map((key) => translate(key, language));
  const groupIds = buildSettlementGroupIds(rows, month);
  const lines = [headers.join(",")];
  rows.forEach((row, rowIndex) => {
    const groupId = groupIds[rowIndex]!;
    const bankAccount = row.influencer.bankAccount;
    // 정산·계좌 필드는 그룹 첫 행에만. 이후 서브타입 행에서는 공란.
    const settlementCells = (first: boolean) =>
      first
        ? [
            bankAccount
              ? translate(BANK_COUNTRY_LABEL_KEY[bankAccount.bankCountry], language)
              : "",
            bankAccount?.bankName ?? "",
            bankAccount?.bankCode ?? "",
            bankAccount?.branchName ?? "",
            bankAccount?.branchCode ?? "",
            bankAccount?.accountNumber ?? "",
            bankAccount?.accountHolder ?? "",
            bankAccount?.invoiceRegistrationNumber ?? "",
            row.rewardAmountJpy,
            row.productRefundJpy,
            row.amountJpy,
            formatDateTime(row.createdAt, language),
            formatDateTime(row.completedAt, language),
            row.status === "COMPLETED"
              ? translate("common.completed", language)
              : translate("common.pending", language),
          ]
        : ["", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    // posts 가 없을 일은 없지만 방어적으로 한 행은 출력.
    const posts = row.posts.length > 0 ? row.posts : [null];
    posts.forEach((post, postIndex) => {
      const first = postIndex === 0;
      lines.push(
        [
          groupId,
          row.influencer.name,
          snsCsvHandle(row),
          row.campaign.title,
          translate(CATEGORY_LABEL_KO[row.campaign.category], language),
          post ? SUB_TYPE_LABEL[post.subType] : "",
          // 복수 URL 은 줄바꿈으로 잇는다 — csvEscape 가 따옴표로 감싸 안전하다.
          post ? postUrls(post).join("\n") : "",
          post ? formatDateTime(post.submittedAt, language) : "",
          post ? formatDateTime(post.insightSubmittedAt, language) : "",
          metricCell(post?.insightLikes ?? null),
          metricCell(post?.insightComments ?? null),
          metricCell(post?.insightShares ?? null),
          metricCell(post?.insightReposts ?? null),
          metricCell(post?.insightSaves ?? null),
          metricCell(post?.insightViews ?? null),
          metricCell(post?.insightReach ?? null),
          ...settlementCells(first),
        ]
          .map(csvEscape)
          .join(","),
      );
    });
  });
  const csv = "﻿" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `settlements-${month}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function currentJstMonth(): string {
  // JST 기준 현재 연-월 (YYYY-MM)
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 7);
}

export function Payouts() {
  const t = useT();
  const { language } = useLanguage();
  const qc = useQueryClient();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [completing, setCompleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState<string>(currentJstMonth);
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [historyTarget, setHistoryTarget] = useState<HistoryTarget | null>(null);
  // 제출물/인사이트 상세 모달 — 응모 단건 조회 후 검수 화면과 동일한 다이얼로그로 표시.
  const submissionDetail = useSubmissionDetail(() =>
    setReloadKey((current) => current + 1),
  );

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    setSelected(new Set());
    // 캠페인 후보는 조회된 월의 정산 행에서 뽑으므로 월이 바뀌면 선택을 비운다.
    setCampaignId(null);
    listSettlements(month)
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : translate("pages.payouts.errors.loadFailed", getStoredLanguage()),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, month]);

  // 정산 대상 캠페인은 대부분 이미 종료돼 있어 진행중 목록(useCampaignOptions)으로는
  // 찾을 수 없다. 조회된 정산 행에서 뽑으면 추가 요청 없이 실제 후보만 남는다.
  const campaignOptions = useMemo(() => {
    if (state.kind !== "ready") return [];
    const byId = new Map<string, string>();
    for (const row of state.rows) byId.set(row.campaign.id, row.campaign.title);
    return [...byId].map(([id, title]) => ({ id, title }));
  }, [state]);

  const visibleRows = useMemo(() => {
    if (state.kind !== "ready") return [];
    // SNS ID 는 bare 로 저장되므로 사용자가 붙여 넣은 "@" 는 떼고 비교한다.
    const keyword = query.trim().replace(/^@/, "").toLowerCase();
    return state.rows.filter((row) => {
      if (categoryFilter !== null && row.campaign.category !== categoryFilter) return false;
      if (campaignId !== null && row.campaign.id !== campaignId) return false;
      if (keyword === "") return true;
      const handles = row.influencer.snsAccounts.map((account) => account.handle);
      return [row.influencer.name, ...handles].some((value) =>
        value.toLowerCase().includes(keyword),
      );
    });
  }, [state, categoryFilter, campaignId, query]);

  const pendingRows = useMemo(
    () => visibleRows.filter((r) => r.status === "PENDING"),
    [visibleRows],
  );

  const summary = useMemo(() => {
    if (state.kind !== "ready") {
      return {
        total: 0,
        pendingCount: 0,
        pendingAmount: 0,
        completedCount: 0,
        completedAmount: 0,
      };
    }
    let pendingAmount = 0;
    let completedCount = 0;
    let completedAmount = 0;
    for (const row of pendingRows) pendingAmount += row.amountJpy;
    for (const row of visibleRows) {
      if (row.status === "COMPLETED") {
        completedCount += 1;
        completedAmount += row.amountJpy;
      }
    }
    return {
      total: visibleRows.length,
      pendingCount: pendingRows.length,
      pendingAmount,
      completedCount,
      completedAmount,
    };
  }, [state, pendingRows]);

  const selectedPendingCount = useMemo(
    () => pendingRows.filter((r) => selected.has(r.id)).length,
    [pendingRows, selected],
  );

  const allPendingSelected = pendingRows.length > 0 && selectedPendingCount === pendingRows.length;
  const somePendingSelected = selectedPendingCount > 0 && !allPendingSelected;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allPendingSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingRows.map((r) => r.id)));
    }
  }

  async function handleComplete() {
    if (selectedPendingCount === 0) return;
    const targetIds = pendingRows.filter((r) => selected.has(r.id)).map((r) => r.id);
    const targetAmount = pendingRows
      .filter((r) => selected.has(r.id))
      .reduce((sum, r) => sum + r.amountJpy, 0);
    const isAll = allPendingSelected;
    const label = isAll
      ? t("pages.payouts.complete.confirmAll", { count: targetIds.length })
      : t("pages.payouts.complete.confirmSelected", { count: targetIds.length });
    if (
      !window.confirm(
        t("pages.payouts.complete.confirmMessage", {
          label,
          amount: targetAmount,
        }),
      )
    ) {
      return;
    }
    setCompleting(true);
    try {
      // 항상 명시적 ID 리스트로 보냄 (월 필터로 현재 화면에 보이는 PENDING만)
      await completeSettlements(targetIds);
      setReloadKey((n) => n + 1);
      qc.invalidateQueries({ queryKey: ["settlements-pending-count"] });
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : t("pages.payouts.errors.completeFailed"),
      );
    } finally {
      setCompleting(false);
    }
  }

  function buildCompleteLabel(): string {
    if (selectedPendingCount === 0) return t("pages.payouts.complete.action");
    if (allPendingSelected) return t("pages.payouts.complete.actionAll");
    return t("pages.payouts.complete.actionCount", { count: selectedPendingCount });
  }
  const completeLabel = buildCompleteLabel();

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("nav.items.payouts")}</h1>
          <p className={styles.subtitle}>{t("pages.payouts.subtitle")}</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.search}>
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input
              placeholder={t("pages.payouts.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <label className={styles.month}>
            <input
              type="month"
              className={styles.monthInput}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <select
            className={styles.monthInput}
            value={categoryFilter ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setCategoryFilter(value === "" ? null : (value as CampaignCategory));
            }}
            aria-label={t("pages.payouts.categoryFilterAria")}
          >
            <option value="">{t("pages.payouts.allCategories")}</option>
            {CATEGORY_FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {t(option.label)}
              </option>
            ))}
          </select>
          <Button
            variant="success"
            size="md"
            onClick={() => state.kind === "ready" && downloadCsv(visibleRows, month)}
            disabled={state.kind !== "ready" || visibleRows.length === 0}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            {t("common.downloadExcel")}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleComplete}
            disabled={completing || selectedPendingCount === 0}
            loading={completing}
          >
            {completing ? t("components.confirmDialog.processing") : completeLabel}
          </Button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <FilterChipBar>
          <CampaignFilterChip
            campaignId={campaignId}
            campaignLabel={
              campaignOptions.find((option) => option.id === campaignId)?.title ?? null
            }
            campaignsLoaded={state.kind === "ready"}
            campaignOptions={campaignOptions}
            onCampaignChange={setCampaignId}
            popoverTitle={t("pages.payouts.campaignPopoverTitle")}
            emptyMessage={t("pages.payouts.campaignPopoverEmpty")}
          />
        </FilterChipBar>
      </div>

      <div className={styles.card}>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t("pages.payouts.summary.total")}</span>
            <span className={styles.summaryValue}>
              {t("common.itemCount", { count: summary.total })}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t("pages.payouts.summary.pendingCount")}</span>
            <span className={styles.summaryValue}>
              {t("common.itemCount", { count: summary.pendingCount })}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t("pages.payouts.summary.pendingAmount")}</span>
            <span className={styles.summaryValue}>
              ¥{summary.pendingAmount.toLocaleString("ja-JP")}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t("common.completed")}</span>
            <span className={styles.summaryValue}>
              {t("common.itemCount", { count: summary.completedCount })}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{t("pages.payouts.summary.completedAmount")}</span>
            <span className={styles.summaryValue}>
              ¥{summary.completedAmount.toLocaleString("ja-JP")}
            </span>
          </div>
        </div>

        {state.kind === "loading" && <div className={styles.empty}>{t("common.loading")}</div>}
        {state.kind === "error" && <div className={styles.empty}>{state.message}</div>}
        {state.kind === "ready" && visibleRows.length === 0 && (
          <div className={styles.empty}>{t("pages.payouts.empty")}</div>
        )}
        {state.kind === "ready" && visibleRows.length > 0 && (
          <ScrollTable minWidth={2140}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.checkCol}>
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePendingSelected;
                      }}
                      onChange={toggleAll}
                      disabled={pendingRows.length === 0}
                      aria-label={t("domains.broadcast.dialog.selectAll")}
                    />
                  </th>
                  <th style={{ minWidth: 120 }}>
                    {t("domains.application.applicants.table.influencer")}
                  </th>
                  <th>{t("pages.payouts.columns.snsId")}</th>
                  <th>{t("domains.application.applicants.table.campaign")}</th>
                  <th style={{ minWidth: 80 }}>
                    {t("domains.application.applicants.table.category")}
                  </th>
                  <th>{t("domains.application.applicants.table.subType")}</th>
                  <th style={{ width: 96 }}>{t("domains.application.drafts.table.submissions")}</th>
                  <th>{t("pages.payouts.columns.postPublishedAt")}</th>
                  <th>{t("pages.payouts.columns.insightSubmittedAt")}</th>
                  <th style={{ width: 70 }}>{t("pages.payouts.bank.country")}</th>
                  <th>{t("pages.payouts.bank.bankName")}</th>
                  <th>{t("pages.payouts.bank.bankCode")}</th>
                  <th>{t("pages.payouts.bank.branchName")}</th>
                  <th>{t("pages.payouts.bank.branchCode")}</th>
                  <th>{t("pages.payouts.bank.accountNumber")}</th>
                  <th>{t("pages.payouts.bank.accountHolder")}</th>
                  <th>{t("pages.payouts.bank.invoiceNumber")}</th>
                  <th>{t("pages.payouts.columns.reward")}</th>
                  <th>{t("pages.payouts.columns.refund")}</th>
                  <th>{t("pages.payouts.columns.total")}</th>
                  <th>{t("pages.payouts.columns.registeredAt")}</th>
                  <th>{t("pages.payouts.columns.completedAt")}</th>
                  <th style={{ width: 70 }}>{t("common.status")}</th>
                  <th style={{ width: 60 }}>
                    {t("domains.application.applicants.actions.history")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isPending = row.status === "PENDING";
                  const appliedAccount = appliedSnsAccount(row);
                  const representativeAccount = pickRepresentativeSnsAccount(
                    row.influencer.snsAccounts,
                  );
                  const categoryBadgeCls =
                    row.campaign.category === "SNS"
                      ? styles.categoryBadgeSns
                      : styles.categoryBadgeFake;
                  return (
                    <tr key={row.id}>
                      <td className={styles.checkCol}>
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label={t("pages.payouts.selectAria")}
                          />
                        ) : null}
                      </td>
                      <td className={styles.nameCell}>{row.influencer.name}</td>
                      <td className={styles.snsCell}>
                        <SnsHandleCell
                          applied={appliedAccount}
                          representative={representativeAccount}
                        />
                      </td>
                      <td>{row.campaign.title}</td>
                      <td>
                        <span className={`${styles.categoryBadge} ${categoryBadgeCls}`}>
                          {t(CATEGORY_LABEL_KO[row.campaign.category])}
                        </span>
                      </td>
                      <td>
                        {row.posts
                          .map((post) => SUB_TYPE_LABEL[post.subType])
                          .join(" / ")}
                      </td>
                      <td>
                        {/* 검토 페이지와 동일한 제출물 보기 링크 UX. */}
                        <button
                          type="button"
                          className={styles.insightLink}
                          onClick={() => submissionDetail.open(row.applicationId)}
                          disabled={submissionDetail.loadingId !== null}
                        >
                          {submissionDetail.loadingId === row.applicationId
                            ? t("common.loading")
                            : t(submissionViewLabelKey(row))}
                        </button>
                      </td>
                      <td>
                        {formatDateTime(
                          latestDate(row.posts.map((post) => post.submittedAt)),
                          language,
                        )}
                      </td>
                      <td>
                        {formatDateTime(
                          latestDate(
                            row.posts.map((post) => post.insightSubmittedAt),
                          ),
                          language,
                        )}
                      </td>
                      <td>
                        {row.influencer.bankAccount
                          ? t(BANK_COUNTRY_LABEL_KEY[row.influencer.bankAccount.bankCountry])
                          : "—"}
                      </td>
                      <td>{row.influencer.bankAccount?.bankName ?? "—"}</td>
                      <td>{row.influencer.bankAccount?.bankCode ?? "—"}</td>
                      {/* 한국 계좌는 지점·인보이스를 쓰지 않아 빈 값으로 저장된다. */}
                      <td>{row.influencer.bankAccount?.branchName || "—"}</td>
                      <td>{row.influencer.bankAccount?.branchCode || "—"}</td>
                      <td>{row.influencer.bankAccount?.accountNumber ?? "—"}</td>
                      <td>{row.influencer.bankAccount?.accountHolder ?? "—"}</td>
                      <td>{row.influencer.bankAccount?.invoiceRegistrationNumber || "—"}</td>
                      <td className={styles.amount}>{formatJpy(row.rewardAmountJpy)}</td>
                      <td className={styles.amount}>{formatRefund(row.productRefundJpy)}</td>
                      <td className={styles.amount}>{formatJpy(row.amountJpy)}</td>
                      <td>{formatDateTime(row.createdAt, language)}</td>
                      <td>{formatDateTime(row.completedAt, language)}</td>
                      <td>
                        {row.status === "COMPLETED" ? (
                          <span className={`${styles.pill} ${styles.pillDone}`}>
                            {t("common.completed")}
                          </span>
                        ) : (
                          <span className={`${styles.pill} ${styles.pillPending}`}>
                            {t("common.pending")}
                          </span>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setHistoryTarget({
                              applicationId: row.applicationId,
                              campaignTitle: row.campaign.title,
                              influencerName: row.influencer.name,
                              statusLabel:
                                row.status === "COMPLETED"
                                  ? t("domains.application.drafts.status.settled")
                                  : t("domains.application.drafts.status.settlementPending"),
                            })
                          }
                        >
                          {t("domains.application.applicants.actions.history")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </div>

      {submissionDetail.dialog}

      {historyTarget && (
        <ApplicationHistoryDialog
          target={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
