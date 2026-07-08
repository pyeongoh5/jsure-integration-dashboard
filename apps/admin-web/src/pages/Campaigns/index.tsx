import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { CampaignResponse } from "@jsure/shared";
import { Card } from "@/components/composites/Card";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { FilterChips } from "@/components/composites/FilterChips";
import { Button } from "@/components/ui";
import {
  CampaignCardTitle,
  CampaignCardBody,
  CampaignCardFooter,
  CampaignActionsMenu,
  closeCampaign,
  listCampaigns,
  campaignFormStyles,
} from "@/domains/campaign";
import type { Campaign, CampaignStatus } from "@/domains/campaign";
import {
  approvedApplicantsCsvFilename,
  buildApprovedApplicantsCsv,
  exportApprovedApplicants,
  triggerCsvDownload,
} from "@/domains/application";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import styles from "./Campaigns.module.css";

type FilterKey = "all" | CampaignStatus;

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "recruit", label: "모집중" },
  { key: "done", label: "완료" },
];

const STATUS_PARAM = "status";

function isFilterKey(value: string | null): value is FilterKey {
  return (
    value === "all" ||
    value === "recruit" ||
    value === "review" ||
    value === "progress" ||
    value === "done"
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function deriveStatus(c: CampaignResponse, now: Date): CampaignStatus {
  if (c.closedAt) return "done";
  const end = new Date(c.recruitEndAt);
  if (now > end) return "done";
  return "recruit";
}

function daysUntil(endIso: string, now: Date): number {
  const end = new Date(endIso);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

function formatDateRange(startYmd: string, endYmd: string): string {
  const fmt = (s: string) => {
    const [, m, d] = s.split("-");
    return `${Number(m)}/${Number(d)}`;
  };
  return `${fmt(startYmd)} — ${fmt(endYmd)}`;
}

function formatReward(jpy: number): string {
  return `¥${jpy.toLocaleString()}円`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCard(c: CampaignResponse, now: Date): Campaign {
  const status = deriveStatus(c, now);
  const capacity = c.recruits.reduce((sum, r) => sum + r.recruitCount, 0);
  return {
    id: c.id,
    brand: "",
    name: c.title,
    description: stripHtml(c.productSummary),
    status,
    thumbIcon: "📋",
    thumbnailUrl: c.thumbnailUrl,
    period: formatDateRange(c.recruitStartDate, c.recruitEndDate),
    reward: formatReward(c.rewardJpy),
    approved: c.approvedCount,
    applied: c.appliedCount,
    capacity,
    dday: daysUntil(c.recruitEndAt, now),
    recruits: c.recruits.map((r) => ({
      subType: r.subType,
      minFollowers: r.minFollowers,
      subTypeOptions: r.subTypeOptions,
    })),
  };
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; campaigns: CampaignResponse[] }
  | { kind: "error"; message: string };

export function Campaigns() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openMenu, setOpenMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listCampaigns()
      .then((campaigns) => {
        if (!cancelled) setState({ kind: "ready", campaigns });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "캠페인을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rawStatus = searchParams.get(STATUS_PARAM);
  const filter: FilterKey = isFilterKey(rawStatus) ? rawStatus : "all";

  const setFilter = (key: FilterKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete(STATUS_PARAM);
    else next.set(STATUS_PARAM, key);
    setSearchParams(next);
  };

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const cards = useMemo(() => {
    if (state.kind !== "ready") return [];
    const now = new Date();
    return state.campaigns.map((c) => toCard(c, now));
  }, [state]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return cards.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (q && !`${c.brand} ${c.name}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cards, filter, debouncedQuery]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>캠페인 관리</h1>
        <p className={styles.subtitle}>전체 캠페인의 상태와 진행 현황을 한눈에 확인하세요.</p>
      </div>

      <div className={styles.toolbar}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <div className={styles.search}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="브랜드 또는 캠페인 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate("/campaigns/new")}
          className={styles.newBtn}
        >
          + 새 캠페인
        </Button>
      </div>

      {state.kind === "loading" ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : state.kind === "error" ? (
        <div className={styles.empty}>
          {state.message}{" "}
          <button
            type="button"
            className={`${campaignFormStyles.btn} ${campaignFormStyles.btnGhost}`}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>조건에 맞는 캠페인이 없습니다.</div>
      ) : (
        <div className={styles.list}>
          {filtered.map((c) => (
            <div
              key={c.id}
              className={styles.camCardWrap}
              onClick={(e) => {
                if (openMenu?.id === c.id) {
                  setOpenMenu(null);
                } else {
                  setOpenMenu({ id: c.id, x: e.clientX, y: e.clientY });
                }
              }}
            >
              <Card
                title={<CampaignCardTitle dday={c.dday} status={c.status} />}
                content={
                  <CampaignCardBody
                    thumbIcon={c.thumbIcon}
                    thumbnailUrl={c.thumbnailUrl}
                    name={c.name}
                    description={c.description}
                    period={c.period}
                    reward={c.reward}
                    recruits={c.recruits}
                  />
                }
                bottomAffix={
                  <CampaignCardFooter
                    approved={c.approved}
                    applied={c.applied}
                    capacity={c.capacity}
                  />
                }
              />
              {openMenu && openMenu.id === c.id && (
                <CampaignActionsMenu
                  anchor={{ x: openMenu.x, y: openMenu.y }}
                  onApplicants={() => {
                    setOpenMenu(null);
                    navigate(`/applicants?campaignId=${encodeURIComponent(c.id)}`);
                  }}
                  onEdit={() => {
                    setOpenMenu(null);
                    navigate(`/campaigns/${encodeURIComponent(c.id)}/edit`);
                  }}
                  onExportApproved={async () => {
                    setOpenMenu(null);
                    try {
                      const response = await exportApprovedApplicants(c.id);
                      const csv = buildApprovedApplicantsCsv(response);
                      triggerCsvDownload(
                        approvedApplicantsCsvFilename(response.campaignTitle),
                        csv,
                      );
                    } catch (cause) {
                      window.alert(
                        cause instanceof Error
                          ? cause.message
                          : "승인자 명단 다운로드에 실패했습니다.",
                      );
                    }
                  }}
                  onClose={() => {
                    setOpenMenu(null);
                    setCloseError(null);
                    setCloseTargetId(c.id);
                  }}
                  onDismiss={() => setOpenMenu(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={closeTargetId !== null}
        title="캠페인 종료"
        subtitle={closeError ?? "이 캠페인을 종료하시겠어요? 종료 후에는 되돌릴 수 없습니다."}
        confirmLabel={closing ? "종료 중…" : "종료"}
        cancelLabel="취소"
        tone="danger"
        busy={closing}
        onConfirm={async () => {
          if (!closeTargetId || closing) return;
          setClosing(true);
          setCloseError(null);
          try {
            await closeCampaign(closeTargetId);
            setCloseTargetId(null);
            setReloadKey((k) => k + 1);
          } catch (err) {
            setCloseError(err instanceof Error ? err.message : "종료에 실패했습니다.");
          } finally {
            setClosing(false);
          }
        }}
        onCancel={() => {
          if (closing) return;
          setCloseTargetId(null);
          setCloseError(null);
        }}
      />
    </div>
  );
}
