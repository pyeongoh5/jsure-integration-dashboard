import { Fragment, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { SUB_TYPE_OPTION_LABEL, type CampaignReportParticipant } from "@jsure/shared";
import { translate, type AdminTranslationKey } from "@i18n/admin";
import { ScrollTable } from "@/components/composites";
import { useSubmissionDetail } from "@/domains/application";
import { Button } from "@/components/ui";
import { getStoredLanguage, useT } from "@/lib/i18n";
import {
  getCampaignParticipants,
  getCampaignReports,
  type CampaignReportRow,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@/domains/report";
import styles from "./Reports.module.css";

const SNS_LABEL: Record<CampaignReportParticipant["subType"], string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  X: "X",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

type ColumnDef = {
  key: CampaignReportSortKey;
  labelKey: AdminTranslationKey;
  numeric: boolean;
  format: (row: CampaignReportRow) => string;
  cellClass?: "titleCell";
};

const COLUMNS: ColumnDef[] = [
  {
    key: "campaignTitle",
    labelKey: "domains.application.applicants.table.campaign",
    numeric: false,
    format: (row) => row.campaignTitle,
    cellClass: "titleCell",
  },
  {
    key: "influencerCount",
    labelKey: "pages.reports.columns.influencerCount",
    numeric: true,
    format: (row) => formatInteger(row.influencerCount),
  },
  {
    key: "totalFollowers",
    labelKey: "pages.reports.columns.totalFollowers",
    numeric: true,
    format: (row) => formatInteger(row.totalFollowers),
  },
  {
    key: "postCount",
    labelKey: "pages.reports.columns.postCount",
    numeric: true,
    format: (row) => formatInteger(row.postCount),
  },
  {
    key: "totalRewardJpy",
    labelKey: "pages.reports.columns.totalRewardJpy",
    numeric: true,
    format: (row) => `¥${formatInteger(row.totalRewardJpy)}`,
  },
  {
    key: "totalLikes",
    labelKey: "domains.report.metrics.likes",
    numeric: true,
    format: (row) => formatInteger(row.totalLikes),
  },
  {
    key: "totalComments",
    labelKey: "domains.report.metrics.comments",
    numeric: true,
    format: (row) => formatInteger(row.totalComments),
  },
  {
    key: "totalShares",
    labelKey: "domains.report.metrics.shares",
    numeric: true,
    format: (row) => formatInteger(row.totalShares),
  },
  {
    key: "totalReposts",
    labelKey: "domains.report.metrics.reposts",
    numeric: true,
    format: (row) => formatInteger(row.totalReposts),
  },
  {
    key: "totalSaves",
    labelKey: "domains.report.metrics.saves",
    numeric: true,
    format: (row) => formatInteger(row.totalSaves),
  },
  {
    key: "totalViews",
    labelKey: "domains.report.metrics.views",
    numeric: true,
    format: (row) => formatInteger(row.totalViews),
  },
  {
    key: "totalReach",
    labelKey: "domains.report.metrics.reach",
    numeric: true,
    format: (row) => formatInteger(row.totalReach),
  },
  {
    key: "totalEngagement",
    labelKey: "domains.report.metrics.engagement",
    numeric: true,
    format: (row) => formatInteger(row.totalEngagement),
  },
  {
    key: "erByViews",
    labelKey: "pages.reports.columns.erByViews",
    numeric: true,
    format: (row) => formatPercent(row.erByViews),
  },
  {
    key: "erByFollowers",
    labelKey: "pages.reports.columns.erByFollowers",
    numeric: true,
    format: (row) => formatPercent(row.erByFollowers),
  },
];

function formatInteger(value: number): string {
  return value.toLocaleString("ja-JP");
}

function formatPercent(value: number | null): string {
  if (value === null) return "-";
  return `${value.toFixed(2)}%`;
}

export function Reports() {
  const t = useT();
  const [rows, setRows] = useState<CampaignReportRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CampaignReportSortKey>("totalEngagement");
  const [sortOrder, setSortOrder] = useState<CampaignReportSortOrder>("desc");
  const [downloadOpen, setDownloadOpen] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggleExpand = (campaignId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCampaignReports(sortKey, sortOrder)
      .then((response) => {
        if (!cancelled) setRows(response.rows);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          const message =
            reason instanceof Error ? reason.message : translate("pages.reports.loadFailed", getStoredLanguage());
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortKey, sortOrder]);

  const handleSortClick = (key: CampaignReportSortKey) => {
    if (key === sortKey) {
      setSortOrder((previous) => (previous === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const subtitle = useMemo(() => {
    if (loading) return t("common.loading");
    if (error) return t("pages.reports.subtitleError", { message: error });
    return t("pages.reports.totalCampaigns", { count: rows.length });
  }, [loading, error, rows.length, t]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{t("nav.items.reports")}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <Button
          variant="success"
          size="md"
          onClick={() => setDownloadOpen(true)}
          disabled={rows.length === 0}
          iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
        >
          {t("common.downloadExcel")}
        </Button>
      </div>

      <div className={styles.card}>
        <ScrollTable minWidth={1600}>
          <table className={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map((column) => {
                  const active = column.key === sortKey;
                  const indicator = active ? (sortOrder === "asc" ? "▲" : "▼") : "↕";
                  return (
                    <th key={column.key} className={column.numeric ? styles.numeric : undefined}>
                      <button
                        type="button"
                        className={styles.sortButton}
                        onClick={() => handleSortClick(column.key)}
                      >
                        <span>{t(column.labelKey)}</span>
                        <span
                          className={`${styles.sortIndicator} ${active ? styles.sortIndicatorActive : ""}`}
                        >
                          {indicator}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className={styles.empty}>
                    {t("pages.reports.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isExpanded = expanded.has(row.campaignId);
                  return (
                    <Fragment key={row.campaignId}>
                      <tr
                        className={styles.expandableRow}
                        onClick={() => toggleExpand(row.campaignId)}
                      >
                        {COLUMNS.map((column, columnIndex) => {
                          const cellClassNames = [
                            column.numeric ? styles.numeric : null,
                            column.cellClass === "titleCell" ? styles.titleCell : null,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <td key={column.key} className={cellClassNames || undefined}>
                              {columnIndex === 0 && (
                                <span
                                  className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ""}`}
                                  aria-hidden="true"
                                >
                                  ▶
                                </span>
                              )}
                              {column.format(row)}
                            </td>
                          );
                        })}
                      </tr>
                      {isExpanded && (
                        <tr className={styles.expandedRow}>
                          <td colSpan={COLUMNS.length} className={styles.expandedCell}>
                            <ParticipantPanel
                              campaignId={row.campaignId}
                              totalCount={row.participantCount}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      {downloadOpen && (
        <CampaignDownloadDialog rows={rows} onClose={() => setDownloadOpen(false)} />
      )}
    </div>
  );
}

type CampaignDownloadDialogProps = {
  rows: CampaignReportRow[];
  onClose: () => void;
};

function CampaignDownloadDialog({ rows, onClose }: CampaignDownloadDialogProps) {
  const t = useT();
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(() => new Set());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (campaignId: string) => {
    setSelectedCampaignIds((previous) => {
      const next = new Set(previous);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const selectableRows = rows.filter((row) => row.participantCount > 0);
  const allSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => selectedCampaignIds.has(row.campaignId));
  const toggleSelectAll = () => {
    setSelectedCampaignIds(
      allSelected ? new Set() : new Set(selectableRows.map((row) => row.campaignId)),
    );
  };

  const handleDownload = async () => {
    const targets = rows.filter((row) => selectedCampaignIds.has(row.campaignId));
    if (targets.length === 0) return;
    setDownloading(true);
    setError(null);
    try {
      const language = getStoredLanguage();
      const workbook = new ExcelJS.Workbook();
      const usedSheetNames = new Set<string>();
      for (const target of targets) {
        // 다운로드 시점에 백엔드에서 전체 참여자 일괄 조회.
        const response = await getCampaignParticipants(
          target.campaignId,
          0,
          Math.max(1, target.participantCount),
        );
        const sheetName = uniqueSheetName(
          target.campaignTitle,
          usedSheetNames,
          translate("domains.application.applicants.table.campaign", language),
        );
        usedSheetNames.add(sheetName);
        const sheet = workbook.addWorksheet(sheetName);
        const sheetColumns = [...PARTICIPANT_COLUMNS, ...EXCEL_ONLY_COLUMNS];
        sheet.columns = sheetColumns.map((column) => ({
          header: translate(column.labelKey, language),
          key: column.key,
          width: column.width ?? (column.numeric ? 12 : 18),
          style: column.numeric ? { alignment: { horizontal: "right" } } : undefined,
        }));
        sheet.getRow(1).font = { bold: true };
        const translateLabel: Translator = (key, params) => translate(key, language, params);
        for (const participant of response.participants) {
          const row: Record<string, string | number> = {};
          for (const column of sheetColumns) {
            row[column.key] = column.excelValue(participant, translateLabel);
          }
          sheet.addRow(row);
        }
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `campaign-reports-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t("pages.reports.downloadDialog.downloadFailed"),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !downloading) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-dialog-title"
      >
        <h2 id="csv-dialog-title" className={styles.dialogTitle}>
          {t("common.downloadExcel")}
        </h2>
        <p className={styles.dialogSubtitle}>{t("pages.reports.downloadDialog.subtitle")}</p>
        <div className={styles.bulkRow}>
          <span>
            {t("pages.reports.downloadDialog.selectedCount", {
              count: selectedCampaignIds.size,
            })}
          </span>
          <Button
            variant={allSelected ? "primary" : "secondary"}
            size="sm"
            onClick={toggleSelectAll}
            disabled={selectableRows.length === 0}
            iconLeft={
              <i
                className={allSelected ? "fa-solid fa-square-check" : "fa-regular fa-square"}
                aria-hidden="true"
              />
            }
          >
            {allSelected
              ? t("domains.broadcast.dialog.deselectAll")
              : t("domains.broadcast.dialog.selectAll")}
          </Button>
        </div>
        <div className={styles.columnList}>
          {rows.map((row) => {
            const isDisabled = row.participantCount === 0;
            return (
              <label
                key={row.campaignId}
                className={`${styles.columnItem} ${isDisabled ? styles.columnItemDisabled : ""}`}
              >
                <input
                  type="checkbox"
                  checked={!isDisabled && selectedCampaignIds.has(row.campaignId)}
                  disabled={isDisabled}
                  onChange={() => toggle(row.campaignId)}
                />
                <span className={styles.columnDesc}>
                  {row.campaignTitle}
                  <span className={styles.campaignItemMeta}>
                    {t("pages.reports.downloadDialog.participantCount", {
                      count: row.participantCount,
                    })}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {error && <div className={styles.dialogError}>{error}</div>}
        <div className={styles.dialogActions}>
          <Button variant="secondary" size="md" onClick={onClose} disabled={downloading}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={handleDownload}
            disabled={selectedCampaignIds.size === 0 || downloading}
            loading={downloading}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            {downloading
              ? t("pages.reports.downloadDialog.generating")
              : t("pages.reports.downloadDialog.download")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 엑셀 시트 이름은 31자 제한 + `\/?*[]:` 금지. 중복 시 (2), (3)... 접미사. */
function uniqueSheetName(rawTitle: string, used: Set<string>, fallbackName: string): string {
  const sanitized =
    rawTitle
      .replace(/[\\/?*[\]:]/g, "_")
      .trim()
      .slice(0, 31) || fallbackName;
  if (!used.has(sanitized)) return sanitized;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tag = ` (${suffix})`;
    const candidate = `${sanitized.slice(0, 31 - tag.length)}${tag}`;
    if (!used.has(candidate)) return candidate;
  }
  return sanitized;
}

type ParticipantPanelProps = {
  campaignId: string;
  totalCount: number;
};

const PARTICIPANTS_PER_PAGE = 20;

type Translator = (
  key: AdminTranslationKey,
  params?: Record<string, string | number>,
) => string;

type ParticipantColumn = {
  key: string;
  labelKey: AdminTranslationKey;
  numeric: boolean;
  /** xlsx 열 너비. 생략하면 numeric 여부로 정한다. */
  width?: number;
  format: (participant: CampaignReportParticipant, translateLabel: Translator) => string;
  excelValue: (
    participant: CampaignReportParticipant,
    translateLabel: Translator,
  ) => string | number;
};

const PARTICIPANT_COLUMNS: ParticipantColumn[] = [
  {
    key: "name",
    labelKey: "common.name",
    numeric: false,
    format: (participant) => participant.influencerName,
    excelValue: (participant) => participant.influencerName,
  },
  {
    key: "sns",
    labelKey: "domains.application.export.sns",
    numeric: false,
    format: (participant) => formatSns(participant),
    excelValue: (participant) => formatSns(participant),
  },
  {
    key: "handle",
    labelKey: "domains.application.export.snsId",
    numeric: false,
    format: (participant) => (participant.handle ? `@${participant.handle}` : "-"),
    excelValue: (participant) => (participant.handle ? `@${participant.handle}` : ""),
  },
  {
    key: "status",
    labelKey: "common.status",
    numeric: false,
    format: (participant, translateLabel) =>
      translateLabel(participantStatusLabelKey(participant)),
    excelValue: (participant, translateLabel) =>
      translateLabel(participantStatusLabelKey(participant)),
  },
  {
    key: "likes",
    labelKey: "domains.report.metrics.likes",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.likes),
    excelValue: (participant) => participant.insight.likes ?? "",
  },
  {
    key: "comments",
    labelKey: "domains.report.metrics.comments",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.comments),
    excelValue: (participant) => participant.insight.comments ?? "",
  },
  {
    key: "shares",
    labelKey: "domains.report.metrics.shares",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.shares),
    excelValue: (participant) => participant.insight.shares ?? "",
  },
  {
    key: "reposts",
    labelKey: "domains.report.metrics.reposts",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.reposts),
    excelValue: (participant) => participant.insight.reposts ?? "",
  },
  {
    key: "saves",
    labelKey: "domains.report.metrics.saves",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.saves),
    excelValue: (participant) => participant.insight.saves ?? "",
  },
  {
    key: "views",
    labelKey: "domains.report.metrics.views",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.views),
    excelValue: (participant) => participant.insight.views ?? "",
  },
  {
    key: "reach",
    labelKey: "domains.report.metrics.reach",
    numeric: false,
    format: (participant) => formatInsightValue(participant.insight.reach),
    excelValue: (participant) => participant.insight.reach ?? "",
  },
];

/**
 * xlsx 에만 넣는 컬럼. 화면 표에는 긴 URL 대신 '제출물' 버튼을 두고
 * 상세는 모달에서 본다.
 */
const EXCEL_ONLY_COLUMNS: ParticipantColumn[] = [
  {
    key: "postUrl",
    labelKey: "pages.reports.columns.postUrl",
    numeric: false,
    width: 48,
    format: (participant) => participant.postUrl ?? "-",
    excelValue: (participant) => participant.postUrl ?? "",
  },
  {
    key: "submittedAt",
    labelKey: "pages.reports.columns.submittedAt",
    numeric: false,
    format: (participant) => formatDate(participant.submittedAt),
    excelValue: (participant) =>
      participant.submittedAt ? formatDate(participant.submittedAt) : "",
  },
];

const PARTICIPANT_STATUS_LABEL_KEY: Record<
  CampaignReportParticipant["status"],
  AdminTranslationKey
> = {
  APPLIED: "domains.application.status.applied",
  REJECTED: "domains.application.status.rejected",
  APPROVED: "pages.reports.participantStatus.approved",
  SHIPPED: "domains.application.status.shipping",
  DELIVERED: "domains.application.history.actions.applicationReceiveConfirm",
  ORDER_SUBMITTED: "pages.reports.participantStatus.orderSubmitted",
  REVIEW_SUBMITTED: "pages.reports.participantStatus.reviewSubmitted",
  COMPLETED: "common.completed",
  CANCELLED: "pages.reports.participantStatus.cancelled",
};

/** 제출 이후에는 검수 결과가 실제 진행 단계라서 상태 대신 검수 상태를 보여준다. */
function participantStatusLabelKey(
  participant: CampaignReportParticipant,
): AdminTranslationKey {
  if (participant.status === "REVIEW_SUBMITTED") {
    if (participant.submissionReviewStatus === "REJECTED") {
      return "pages.reports.participantStatus.reviewRejected";
    }
    if (participant.submissionReviewStatus === "APPROVED") {
      return "pages.reports.participantStatus.reviewApproved";
    }
    return "pages.reports.participantStatus.reviewPending";
  }
  return PARTICIPANT_STATUS_LABEL_KEY[participant.status];
}

function formatSns(participant: CampaignReportParticipant): string {
  const snsLabel = SNS_LABEL[participant.subType];
  return participant.option
    ? `${snsLabel}(${SUB_TYPE_OPTION_LABEL[participant.option] ?? participant.option})`
    : snsLabel;
}

function formatInsightValue(value: number | null): string {
  return value === null ? "-" : formatInteger(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function ParticipantPanel({ campaignId, totalCount }: ParticipantPanelProps) {
  const t = useT();
  const submissionDetail = useSubmissionDetail();
  const [page, setPage] = useState(0);
  const [participants, setParticipants] = useState<CampaignReportParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 참여자 1명이 여러 서브타입에 참여하면 행 수 > 명 수라 페이지 수는 응답의 total 로 센다.
  const [rowTotal, setRowTotal] = useState(totalCount);
  const totalPages = Math.max(1, Math.ceil(rowTotal / PARTICIPANTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (totalCount === 0) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    getCampaignParticipants(campaignId, safePage, PARTICIPANTS_PER_PAGE)
      .then((response) => {
        if (cancelled) return;
        setParticipants(response.participants);
        setRowTotal(response.total);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(
            reason instanceof Error
              ? reason.message
              : translate("pages.reports.participants.loadFailed", getStoredLanguage()),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, safePage, totalCount]);

  if (totalCount === 0) {
    return <div className={styles.participantsEmpty}>{t("pages.reports.participants.empty")}</div>;
  }

  return (
    <div className={styles.participantsPanel}>
      <div className={styles.participantsHeader}>
        <span className={styles.participantsTitle}>
          {t("pages.reports.participants.title", { count: totalCount })}
        </span>
        <span className={styles.participantsSubtitle}>
          {t("pages.reports.participants.subtitle")}
        </span>
      </div>
      <div className={styles.participantsTableWrap}>
        <table className={styles.participantsTable}>
          <thead>
            <tr>
              {PARTICIPANT_COLUMNS.map((column) => (
                <th key={column.key} className={column.numeric ? styles.numeric : undefined}>
                  {t(column.labelKey)}
                </th>
              ))}
              <th>{t("domains.application.drafts.table.submissions")}</th>
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr>
                <td colSpan={PARTICIPANT_COLUMNS.length + 1} className={styles.participantsEmpty}>
                  {loadError}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={PARTICIPANT_COLUMNS.length + 1} className={styles.participantsEmpty}>
                  {t("common.loading")}
                </td>
              </tr>
            ) : (
              participants.map((participant, index) => (
                <tr
                  key={`${participant.influencerId}-${participant.subType}-${safePage * PARTICIPANTS_PER_PAGE + index}`}
                >
                  {PARTICIPANT_COLUMNS.map((column) => (
                    <td key={column.key} className={column.numeric ? styles.numeric : undefined}>
                      {column.format(participant, t)}
                    </td>
                  ))}
                  <td>
                    {participant.submittedAt === null ? (
                      "-"
                    ) : (
                      <button
                        type="button"
                        className={styles.submissionLink}
                        onClick={() => submissionDetail.open(participant.applicationId)}
                        disabled={submissionDetail.loadingId !== null}
                      >
                        {submissionDetail.loadingId === participant.applicationId
                          ? t("common.loading")
                          : t("common.view")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {submissionDetail.dialog}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0 || loading}
          >
            {t("common.previous")}
          </Button>
          <span className={styles.pageStatus}>
            {safePage + 1} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={safePage >= totalPages - 1 || loading}
          >
            {t("common.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
