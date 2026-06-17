import { Fragment, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import type { CampaignReportParticipant } from "@jsure/shared";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import {
  getCampaignParticipants,
  getCampaignReports,
  type CampaignReportRow,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@/domains/report";
import { INSTAGRAM_POST_TYPE_LABEL } from "@/domains/campaign";
import styles from "./Reports.module.css";

const SNS_LABEL: Record<CampaignReportParticipant["snsType"], string> = {
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
  TIKTOK: "TikTok",
  X: "X",
};

type ColumnDef = {
  key: CampaignReportSortKey;
  label: string;
  numeric: boolean;
  format: (row: CampaignReportRow) => string;
  cellClass?: "titleCell";
};

const COLUMNS: ColumnDef[] = [
  {
    key: "campaignTitle",
    label: "캠페인",
    numeric: false,
    format: (row) => row.campaignTitle,
    cellClass: "titleCell",
  },
  {
    key: "influencerCount",
    label: "인플루언서 수",
    numeric: true,
    format: (row) => formatInteger(row.influencerCount),
  },
  {
    key: "totalFollowers",
    label: "총 팔로워",
    numeric: true,
    format: (row) => formatInteger(row.totalFollowers),
  },
  {
    key: "postCount",
    label: "콘텐츠 수",
    numeric: true,
    format: (row) => formatInteger(row.postCount),
  },
  {
    key: "totalRewardJpy",
    label: "총 광고비(¥)",
    numeric: true,
    format: (row) => `¥${formatInteger(row.totalRewardJpy)}`,
  },
  {
    key: "totalLikes",
    label: "좋아요",
    numeric: true,
    format: (row) => formatInteger(row.totalLikes),
  },
  {
    key: "totalComments",
    label: "댓글",
    numeric: true,
    format: (row) => formatInteger(row.totalComments),
  },
  {
    key: "totalShares",
    label: "공유",
    numeric: true,
    format: (row) => formatInteger(row.totalShares),
  },
  {
    key: "totalReposts",
    label: "리포스트",
    numeric: true,
    format: (row) => formatInteger(row.totalReposts),
  },
  {
    key: "totalSaves",
    label: "저장",
    numeric: true,
    format: (row) => formatInteger(row.totalSaves),
  },
  {
    key: "totalViews",
    label: "조회",
    numeric: true,
    format: (row) => formatInteger(row.totalViews),
  },
  {
    key: "totalReach",
    label: "도달",
    numeric: true,
    format: (row) => formatInteger(row.totalReach),
  },
  {
    key: "totalEngagement",
    label: "인게이지먼트",
    numeric: true,
    format: (row) => formatInteger(row.totalEngagement),
  },
  {
    key: "erByViews",
    label: "ER(조회%)",
    numeric: true,
    format: (row) => formatPercent(row.erByViews),
  },
  {
    key: "erByFollowers",
    label: "ER(팔로워%)",
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
          const message = reason instanceof Error ? reason.message : "불러오기에 실패했습니다.";
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
    if (loading) return "불러오는 중...";
    if (error) return `오류: ${error}`;
    return `총 ${rows.length}개 캠페인`;
  }, [loading, error, rows.length]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>리포트</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <Button
          variant="success"
          size="md"
          onClick={() => setDownloadOpen(true)}
          disabled={rows.length === 0}
          iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
        >
          엑셀 다운로드
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
                        <span>{column.label}</span>
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
                    표시할 데이터가 없습니다.
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
      const workbook = new ExcelJS.Workbook();
      const usedSheetNames = new Set<string>();
      for (const target of targets) {
        // 다운로드 시점에 백엔드에서 전체 참여자 일괄 조회.
        const response = await getCampaignParticipants(
          target.campaignId,
          0,
          Math.max(1, target.participantCount),
        );
        const sheetName = uniqueSheetName(target.campaignTitle, usedSheetNames);
        usedSheetNames.add(sheetName);
        const sheet = workbook.addWorksheet(sheetName);
        sheet.columns = PARTICIPANT_COLUMNS.map((column) => ({
          header: column.label,
          key: column.key,
          width: column.numeric ? 12 : 18,
          style: column.numeric ? { alignment: { horizontal: "right" } } : undefined,
        }));
        sheet.getRow(1).font = { bold: true };
        for (const participant of response.participants) {
          const row: Record<string, string | number> = {};
          for (const column of PARTICIPANT_COLUMNS) {
            row[column.key] = column.excelValue(participant);
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
      setError(reason instanceof Error ? reason.message : "다운로드에 실패했습니다.");
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
          엑셀 다운로드
        </h2>
        <p className={styles.dialogSubtitle}>
          다운로드할 캠페인을 선택하세요. 각 캠페인의 정산 완료 참여자가 시트별로 저장됩니다.
        </p>
        <div className={styles.bulkRow}>
          <span>{selectedCampaignIds.size}개 선택됨</span>
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
            {allSelected ? "전체 해제" : "전체 선택"}
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
                    참여 완료 {row.participantCount}명
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {error && <div className={styles.dialogError}>{error}</div>}
        <div className={styles.dialogActions}>
          <Button variant="secondary" size="md" onClick={onClose} disabled={downloading}>
            취소
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={handleDownload}
            disabled={selectedCampaignIds.size === 0 || downloading}
            loading={downloading}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            {downloading ? "생성 중..." : "다운로드"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 엑셀 시트 이름은 31자 제한 + `\/?*[]:` 금지. 중복 시 (2), (3)... 접미사. */
function uniqueSheetName(rawTitle: string, used: Set<string>): string {
  const sanitized =
    rawTitle
      .replace(/[\\/?*[\]:]/g, "_")
      .trim()
      .slice(0, 31) || "캠페인";
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

const PARTICIPANT_COLUMNS: Array<{
  key: string;
  label: string;
  numeric: boolean;
  format: (participant: CampaignReportParticipant) => string;
  excelValue: (participant: CampaignReportParticipant) => string | number;
}> = [
  {
    key: "name",
    label: "이름",
    numeric: false,
    format: (participant) => participant.influencerName,
    excelValue: (participant) => participant.influencerName,
  },
  {
    key: "id",
    label: "ID",
    numeric: false,
    format: (participant) => participant.influencerId,
    excelValue: (participant) => participant.influencerId,
  },
  {
    key: "sns",
    label: "SNS",
    numeric: false,
    format: (participant) => formatSns(participant),
    excelValue: (participant) => formatSns(participant),
  },
  {
    key: "handle",
    label: "핸들",
    numeric: false,
    format: (participant) => (participant.handle ? `@${participant.handle}` : "-"),
    excelValue: (participant) => (participant.handle ? `@${participant.handle}` : ""),
  },
  {
    key: "likes",
    label: "좋아요",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.likes),
    excelValue: (participant) => participant.insight.likes ?? "",
  },
  {
    key: "comments",
    label: "댓글",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.comments),
    excelValue: (participant) => participant.insight.comments ?? "",
  },
  {
    key: "shares",
    label: "공유",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.shares),
    excelValue: (participant) => participant.insight.shares ?? "",
  },
  {
    key: "reposts",
    label: "리포스트",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.reposts),
    excelValue: (participant) => participant.insight.reposts ?? "",
  },
  {
    key: "saves",
    label: "저장",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.saves),
    excelValue: (participant) => participant.insight.saves ?? "",
  },
  {
    key: "views",
    label: "조회",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.views),
    excelValue: (participant) => participant.insight.views ?? "",
  },
  {
    key: "reach",
    label: "도달",
    numeric: true,
    format: (participant) => formatInsightValue(participant.insight.reach),
    excelValue: (participant) => participant.insight.reach ?? "",
  },
];

function formatSns(participant: CampaignReportParticipant): string {
  const snsLabel = SNS_LABEL[participant.snsType];
  return participant.snsType === "INSTAGRAM" && participant.instagramPostType
    ? `${snsLabel}(${INSTAGRAM_POST_TYPE_LABEL[participant.instagramPostType]})`
    : snsLabel;
}

function formatInsightValue(value: number | null): string {
  return value === null ? "-" : formatInteger(value);
}

function ParticipantPanel({ campaignId, totalCount }: ParticipantPanelProps) {
  const [page, setPage] = useState(0);
  const [participants, setParticipants] = useState<CampaignReportParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalCount / PARTICIPANTS_PER_PAGE));
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
        if (!cancelled) setParticipants(response.participants);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setLoadError(
            reason instanceof Error ? reason.message : "참여자 목록을 불러올 수 없습니다.",
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
    return <div className={styles.participantsEmpty}>정산 완료된 참여자가 없습니다.</div>;
  }

  return (
    <div className={styles.participantsPanel}>
      <div className={styles.participantsHeader}>
        <span className={styles.participantsTitle}>정산 완료 참여자 ({totalCount}명)</span>
      </div>
      <div className={styles.participantsTableWrap}>
        <table className={styles.participantsTable}>
          <thead>
            <tr>
              {PARTICIPANT_COLUMNS.map((column) => (
                <th key={column.key} className={column.numeric ? styles.numeric : undefined}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr>
                <td colSpan={PARTICIPANT_COLUMNS.length} className={styles.participantsEmpty}>
                  {loadError}
                </td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={PARTICIPANT_COLUMNS.length} className={styles.participantsEmpty}>
                  불러오는 중...
                </td>
              </tr>
            ) : (
              participants.map((participant, index) => (
                <tr
                  key={`${participant.influencerId}-${participant.snsType}-${safePage * PARTICIPANTS_PER_PAGE + index}`}
                >
                  {PARTICIPANT_COLUMNS.map((column) => (
                    <td key={column.key} className={column.numeric ? styles.numeric : undefined}>
                      {column.format(participant)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={safePage === 0 || loading}
          >
            이전
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
            다음
          </Button>
        </div>
      )}
    </div>
  );
}
