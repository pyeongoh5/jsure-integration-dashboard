import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SUB_TYPE_LABEL, type AdminSettlement, type CampaignCategory } from "@jsure/shared";
import {
  completeSettlements,
  listSettlements,
  useSubmissionDetail,
  CampaignFilterChip,
  CATEGORY_LABEL_KO,
  CATEGORY_FILTER_OPTIONS,
} from "@/domains/application";
import { ScrollTable } from "@/components/composites";
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

function formatRefund(amount: number): string {
  return amount === 0 ? "—" : `¥${amount.toLocaleString("ja-JP")}`;
}

// 투고/인사이트는 응모 단위 일괄 제출이라 서브타입별로 다르지 않음 — 가장 늦은 시각 하나로 대표.
function latestDate(values: (string | null)[]): string | null {
  const submitted = values.filter((value): value is string => value !== null);
  return submitted.length === 0 ? null : submitted.sort()[submitted.length - 1]!;
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

const BANK_COUNTRY_LABEL: Record<"JP" | "KR", string> = {
  JP: "일본",
  KR: "한국",
};

function metricCell(value: number | null): string {
  return value === null ? "" : String(value);
}

// 검토 페이지(DraftTable)의 보기 버튼 라벨과 동일 규칙.
function submissionViewLabel(row: AdminSettlement): string {
  if (row.campaign.category !== "SNS") return "제출 결과 보기";
  const insightSubmitted =
    row.posts.length > 0 &&
    row.posts.every((post) => post.insightSubmittedAt !== null);
  return insightSubmitted ? "인사이트 보기" : "제출 보기";
}

function downloadCsv(rows: AdminSettlement[], month: string): void {
  const headers = [
    "그룹 ID",
    "인플루언서",
    "캠페인",
    "카테고리",
    "SNS",
    "제출 URL",
    "투고 게시일",
    "인사이트 제출일",
    "좋아요",
    "댓글",
    "공유",
    "리포스트",
    "저장",
    "조회",
    "리치",
    "계좌 국가",
    "은행명",
    "은행코드",
    "지점명",
    "지점코드",
    "계좌번호",
    "계좌명의",
    "인보이스 등록번호",
    "보수(JPY)",
    "상품환급(JPY)",
    "합계(JPY)",
    "정산 등록일",
    "정산 완료일",
    "상태",
  ];
  const groupIds = buildSettlementGroupIds(rows, month);
  const lines = [headers.join(",")];
  rows.forEach((row, rowIndex) => {
    const groupId = groupIds[rowIndex]!;
    const bankAccount = row.influencer.bankAccount;
    // 정산·계좌 필드는 그룹 첫 행에만. 이후 서브타입 행에서는 공란.
    const settlementCells = (first: boolean) =>
      first
        ? [
            bankAccount ? BANK_COUNTRY_LABEL[bankAccount.bankCountry] : "",
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
            formatDateTime(row.createdAt),
            formatDateTime(row.completedAt),
            row.status === "COMPLETED" ? "완료" : "대기",
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
          row.campaign.title,
          CATEGORY_LABEL_KO[row.campaign.category],
          post ? SUB_TYPE_LABEL[post.subType] : "",
          post?.url ?? "",
          post ? formatDateTime(post.submittedAt) : "",
          post ? formatDateTime(post.insightSubmittedAt) : "",
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
  const qc = useQueryClient();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [completing, setCompleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [month, setMonth] = useState<string>(currentJstMonth);
  const [categoryFilter, setCategoryFilter] =
    useState<CampaignCategory | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  // 제출물/인사이트 상세 모달 — 응모 단건 조회 후 검수 화면과 동일한 다이얼로그로 표시.
  const submissionDetail = useSubmissionDetail();

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
          message: err instanceof Error ? err.message : "정산 목록을 불러올 수 없습니다.",
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
    return state.rows.filter((row) => {
      if (categoryFilter !== null && row.campaign.category !== categoryFilter) return false;
      if (campaignId !== null && row.campaign.id !== campaignId) return false;
      return true;
    });
  }, [state, categoryFilter, campaignId]);

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
          <select
            className={styles.monthInput}
            value={categoryFilter ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setCategoryFilter(value === "" ? null : (value as CampaignCategory));
            }}
            aria-label="카테고리 필터"
          >
            <option value="">전체 카테고리</option>
            {CATEGORY_FILTER_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
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
            popoverTitle="캠페인 선택 (이 달 정산 대상)"
            emptyMessage="이 달 정산 대상 캠페인이 없습니다."
          />
        </FilterChipBar>
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
        {state.kind === "ready" && visibleRows.length === 0 && (
          <div className={styles.empty}>정산 대상이 없습니다.</div>
        )}
        {state.kind === "ready" && visibleRows.length > 0 && (
          <ScrollTable minWidth={2000}>
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
                  <th style={{ minWidth: 80 }}>카테고리</th>
                  <th>서브타입</th>
                  <th style={{ width: 96 }}>제출물</th>
                  <th>투고 게시일</th>
                  <th>인사이트 제출일</th>
                  <th style={{ width: 70 }}>계좌 국가</th>
                  <th>은행명</th>
                  <th>은행코드</th>
                  <th>지점명</th>
                  <th>지점코드</th>
                  <th>계좌번호</th>
                  <th>계좌명의</th>
                  <th>인보이스 등록번호</th>
                  <th>보수</th>
                  <th>상품환급</th>
                  <th>합계</th>
                  <th>정산 등록일</th>
                  <th>정산 완료일</th>
                  <th style={{ width: 70 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isPending = row.status === "PENDING";
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
                            aria-label="선택"
                          />
                        ) : null}
                      </td>
                      <td>{row.influencer.name}</td>
                      <td>{row.campaign.title}</td>
                      <td>
                        <span className={`${styles.categoryBadge} ${categoryBadgeCls}`}>
                          {CATEGORY_LABEL_KO[row.campaign.category]}
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
                            ? "불러오는 중…"
                            : submissionViewLabel(row)}
                        </button>
                      </td>
                      <td>
                        {formatDateTime(
                          latestDate(row.posts.map((post) => post.submittedAt)),
                        )}
                      </td>
                      <td>
                        {formatDateTime(
                          latestDate(
                            row.posts.map((post) => post.insightSubmittedAt),
                          ),
                        )}
                      </td>
                      <td>
                        {row.influencer.bankAccount
                          ? BANK_COUNTRY_LABEL[row.influencer.bankAccount.bankCountry]
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

      {submissionDetail.dialog}
    </div>
  );
}
