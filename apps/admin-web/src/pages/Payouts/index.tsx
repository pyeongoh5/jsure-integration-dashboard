import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminSettlement } from "@jsure/shared";
import { completeSettlements, listSettlements } from "@/domains/application";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import styles from "./Payouts.module.css";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminSettlement[] }
  | { kind: "error"; message: string };

function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(rows: AdminSettlement[], month: string): void {
  const headers = [
    "정산 ID",
    "인플루언서",
    "캠페인",
    "SNS",
    "투고 URL",
    "투고 게시일",
    "인사이트 제출일",
    "정산 금액(JPY)",
    "정산 등록일",
    "정산 완료일",
    "상태",
  ];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.influencer.name,
        row.campaign.title,
        row.post.snsType,
        row.post.url,
        formatDateTime(row.post.submittedAt),
        formatDateTime(row.post.insightSubmittedAt),
        row.amountJpy,
        formatDateTime(row.createdAt),
        formatDateTime(row.completedAt),
        row.status === "COMPLETED" ? "완료" : "대기",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
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
  const qc = useQueryClient();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [completing, setCompleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState<string>(currentJstMonth);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    setSelected(new Set());
    listSettlements(month)
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "정산 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey, month]);

  const pendingRows = useMemo(
    () => (state.kind === "ready" ? state.rows.filter((r) => r.status === "PENDING") : []),
    [state],
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
    for (const row of state.rows) {
      if (row.status === "COMPLETED") {
        completedCount += 1;
        completedAmount += row.amountJpy;
      }
    }
    return {
      total: state.rows.length,
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
    const label = isAll ? `전체 ${targetIds.length}건` : `선택한 ${targetIds.length}건`;
    if (
      !window.confirm(
        `${label} (¥${targetAmount.toLocaleString("ja-JP")})을 정산 완료 처리하시겠습니까?`,
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
      window.alert(err instanceof Error ? err.message : "완료 처리에 실패했습니다.");
    } finally {
      setCompleting(false);
    }
  }

  const completeLabel =
    selectedPendingCount === 0
      ? "정산 완료 처리"
      : allPendingSelected
        ? "전체 정산 완료 처리"
        : `${selectedPendingCount}건 정산 완료 처리`;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>정산 관리</h1>
          <p className={styles.subtitle}>선택한 월 안에 인사이트가 제출된 건이 표시됩니다.</p>
        </div>
        <div className={styles.actions}>
          <label className={styles.month}>
            <input
              type="month"
              className={styles.monthInput}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <Button
            variant="success"
            size="md"
            onClick={() => state.kind === "ready" && downloadCsv(state.rows, month)}
            disabled={state.kind !== "ready" || state.rows.length === 0}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            엑셀 다운로드
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleComplete}
            disabled={completing || selectedPendingCount === 0}
            loading={completing}
          >
            {completing ? "처리 중…" : completeLabel}
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>전체</span>
            <span className={styles.summaryValue}>{summary.total}건</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>미완료</span>
            <span className={styles.summaryValue}>{summary.pendingCount}건</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>미완료 금액</span>
            <span className={styles.summaryValue}>
              ¥{summary.pendingAmount.toLocaleString("ja-JP")}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>완료</span>
            <span className={styles.summaryValue}>{summary.completedCount}건</span>
          </div>
          <div className={styles.summaryItem}>
            <span className={styles.summaryLabel}>완료 금액</span>
            <span className={styles.summaryValue}>
              ¥{summary.completedAmount.toLocaleString("ja-JP")}
            </span>
          </div>
        </div>

        {state.kind === "loading" && <div className={styles.empty}>불러오는 중…</div>}
        {state.kind === "error" && <div className={styles.empty}>{state.message}</div>}
        {state.kind === "ready" && state.rows.length === 0 && (
          <div className={styles.empty}>정산 대상이 없습니다.</div>
        )}
        {state.kind === "ready" && state.rows.length > 0 && (
          <ScrollTable minWidth={1200}>
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
                      aria-label="전체 선택"
                    />
                  </th>
                  <th>인플루언서</th>
                  <th>캠페인</th>
                  <th>매체</th>
                  <th>투고 게시일</th>
                  <th>인사이트 제출일</th>
                  <th>금액</th>
                  <th>정산 등록일</th>
                  <th>정산 완료일</th>
                  <th style={{ width: 70 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => {
                  const isPending = row.status === "PENDING";
                  return (
                    <tr key={row.id}>
                      <td className={styles.checkCol}>
                        {isPending ? (
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            aria-label="선택"
                          />
                        ) : null}
                      </td>
                      <td>{row.influencer.name}</td>
                      <td>{row.campaign.title}</td>
                      <td>{row.post.snsType}</td>
                      <td>{formatDateTime(row.post.submittedAt)}</td>
                      <td>{formatDateTime(row.post.insightSubmittedAt)}</td>
                      <td className={styles.amount}>{formatJpy(row.amountJpy)}</td>
                      <td>{formatDateTime(row.createdAt)}</td>
                      <td>{formatDateTime(row.completedAt)}</td>
                      <td>
                        {row.status === "COMPLETED" ? (
                          <span className={`${styles.pill} ${styles.pillDone}`}>완료</span>
                        ) : (
                          <span className={`${styles.pill} ${styles.pillPending}`}>대기</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        )}
      </div>
    </div>
  );
}
