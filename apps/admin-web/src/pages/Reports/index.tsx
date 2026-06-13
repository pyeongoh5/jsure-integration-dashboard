import { useEffect, useMemo, useState } from "react";
import { ScrollTable } from "@/components/composites";
import {
  getCampaignReports,
  type CampaignReportRow,
  type CampaignReportSortKey,
  type CampaignReportSortOrder,
} from "@/domains/report";
import styles from "./Reports.module.css";

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
  const [sortKey, setSortKey] =
    useState<CampaignReportSortKey>("totalEngagement");
  const [sortOrder, setSortOrder] = useState<CampaignReportSortOrder>("desc");
  const [downloadOpen, setDownloadOpen] = useState<boolean>(false);

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
            reason instanceof Error
              ? reason.message
              : "불러오기에 실패했습니다.";
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
        <button
          type="button"
          className={styles.downloadButton}
          onClick={() => setDownloadOpen(true)}
          disabled={rows.length === 0}
        >
          엑셀(CSV) 다운로드
        </button>
      </div>

      <div className={styles.card}>
      <ScrollTable minWidth={1600}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((column) => {
                const active = column.key === sortKey;
                const indicator = active
                  ? sortOrder === "asc"
                    ? "▲"
                    : "▼"
                  : "↕";
                return (
                  <th
                    key={column.key}
                    className={column.numeric ? styles.numeric : undefined}
                  >
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
              rows.map((row) => (
                <tr key={row.campaignId}>
                  {COLUMNS.map((column) => {
                    const cellClassNames = [
                      column.numeric ? styles.numeric : null,
                      column.cellClass === "titleCell"
                        ? styles.titleCell
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <td
                        key={column.key}
                        className={cellClassNames || undefined}
                      >
                        {column.format(row)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ScrollTable>
      </div>

      {downloadOpen && (
        <CsvDownloadDialog
          rows={rows}
          onClose={() => setDownloadOpen(false)}
        />
      )}
    </div>
  );
}

type CsvDownloadDialogProps = {
  rows: CampaignReportRow[];
  onClose: () => void;
};

function CsvDownloadDialog({ rows, onClose }: CsvDownloadDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<CampaignReportSortKey>>(
    () => new Set(COLUMNS.map((column) => column.key)),
  );

  const toggle = (key: CampaignReportSortKey) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedKeys(new Set(COLUMNS.map((column) => column.key)));
  const clearAll = () => setSelectedKeys(new Set());

  const handleDownload = () => {
    const selectedColumns = COLUMNS.filter((column) =>
      selectedKeys.has(column.key),
    );
    if (selectedColumns.length === 0) return;
    const csv = buildCsv(rows, selectedColumns);
    const bom = "﻿";
    const blob = new Blob([bom + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `campaign-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      className={styles.dialogBackdrop}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-dialog-title"
      >
        <h2 id="csv-dialog-title" className={styles.dialogTitle}>
          CSV 다운로드
        </h2>
        <p className={styles.dialogSubtitle}>
          다운로드할 컬럼을 선택하세요.
        </p>
        <div className={styles.bulkRow}>
          <span>{selectedKeys.size}개 선택됨</span>
          <span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={selectAll}
            >
              모두 선택
            </button>
            {" / "}
            <button
              type="button"
              className={styles.linkButton}
              onClick={clearAll}
            >
              모두 해제
            </button>
          </span>
        </div>
        <div className={styles.columnList}>
          {COLUMNS.map((column) => (
            <label key={column.key} className={styles.columnItem}>
              <input
                type="checkbox"
                checked={selectedKeys.has(column.key)}
                onChange={() => toggle(column.key)}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        <div className={styles.dialogActions}>
          <button
            type="button"
            className={styles.dialogBtn}
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className={`${styles.dialogBtn} ${styles.dialogBtnPrimary}`}
            onClick={handleDownload}
            disabled={selectedKeys.size === 0}
          >
            다운로드
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeCsvCell(value: string): string {
  if (
    value.includes('"') ||
    value.includes(",") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(
  rows: CampaignReportRow[],
  columns: ColumnDef[],
): string {
  const header = columns
    .map((column) => escapeCsvCell(column.label))
    .join(",");
  const body = rows
    .map((row) =>
      columns.map((column) => escapeCsvCell(column.format(row))).join(","),
    )
    .join("\r\n");
  return body ? `${header}\r\n${body}` : header;
}
