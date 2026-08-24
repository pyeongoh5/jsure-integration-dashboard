import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatRewardRange, type CampaignResponse } from "@jsure/shared";
import { Card } from "@/components/composites/Card";
import {
  FilterChipBar,
  SingleSelectFilterChip,
} from "@/components/composites/FilterChip";
import { Button } from "@/components/ui";
import {
  CampaignCardTitle,
  CampaignCardBody,
  CampaignCardFooter,
  CampaignActionsMenu,
  BumpCampaignDialog,
  CloseCampaignDialog,
  DeleteCampaignDialog,
  HideCampaignDialog,
  UnhideCampaignDialog,
  listCampaigns,
  campaignFormStyles,
} from "@/domains/campaign";
import type { Campaign, CampaignCategory, CampaignStatus } from "@/domains/campaign";
import { CATEGORY_FILTER_OPTIONS } from "@/domains/application";
import { translate, type AdminTranslationKey } from "@i18n/admin";
import { getStoredLanguage, useT } from "@/lib/i18n";
import { foldForSearch } from "@/lib/searchText";
import { ApprovedApplicantsDialog } from "../Applicants/ApprovedApplicantsDialog";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import styles from "./Campaigns.module.css";

type StatusFilterKey = "all" | CampaignStatus;

const STATUS_FILTER_CHIP_OPTIONS: readonly {
  key: CampaignStatus;
  label: AdminTranslationKey;
}[] = [
  { key: "recruit", label: "domains.campaign.status.recruit" },
  { key: "full", label: "domains.campaign.status.full" },
  { key: "done", label: "domains.campaign.status.done" },
  { key: "draft", label: "domains.campaign.status.draft" },
  { key: "hidden", label: "domains.campaign.status.hidden" },
];

const STATUS_PARAM = "status";
const CATEGORY_PARAM = "category";

function isStatusFilterKey(value: string | null): value is StatusFilterKey {
  return (
    value === "all" ||
    value === "recruit" ||
    value === "full" ||
    value === "done" ||
    value === "draft" ||
    value === "hidden"
  );
}

function isCategory(value: string | null): value is CampaignCategory {
  return value === "SNS" || value === "FAKE_PURCHASE" || value === "SIMPLE_REVIEW";
}

const DAY_MS = 24 * 60 * 60 * 1000;

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

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toCard(c: CampaignResponse, now: Date): Campaign {
  const status = c.status; // 상태·정렬은 서버가 계산해 내려준다.
  // 단순 리뷰는 응모자가 전 서브타입에 동시 응모하므로 정원은 합이 아니라 단일값(전 서브타입 동일).
  const capacity =
    c.category === "SIMPLE_REVIEW"
      ? c.recruits.reduce((max, r) => Math.max(max, r.recruitCount), 0)
      : c.recruits.reduce((sum, r) => sum + r.recruitCount, 0);
  return {
    id: c.id,
    brand: "",
    name: c.title,
    tags: c.tags,
    description: stripHtml(c.productSummary),
    category: c.category,
    status,
    thumbIcon: "📋",
    thumbnailUrl: c.thumbnailUrl,
    period: formatDateRange(c.recruitStartDate, c.recruitEndDate),
    // 개별보수(PER_SUBTYPE)는 c.rewardJpy 가 0 이고 실제 보수가 recruit/옵션에 있다.
    reward: formatRewardRange(c),
    approved: c.approvedCount,
    applied: c.appliedCount,
    capacity,
    dday: daysUntil(c.recruitEndAt, now),
    updatedAt: c.updatedAt,
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
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openMenu, setOpenMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [approvedListCampaignId, setApprovedListCampaignId] = useState<string | null>(null);
  const [bumpTargetId, setBumpTargetId] = useState<string | null>(null);
  const [closeTargetId, setCloseTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [hideTargetId, setHideTargetId] = useState<string | null>(null);
  const [unhideTargetId, setUnhideTargetId] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listCampaigns({ includeDrafts: true })
      .then((campaigns) => {
        if (!cancelled) setState({ kind: "ready", campaigns });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error
              ? err.message
              : translate("domains.campaign.errors.loadFailed", getStoredLanguage()),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const rawStatus = searchParams.get(STATUS_PARAM);
  const statusFilter: StatusFilterKey = isStatusFilterKey(rawStatus) ? rawStatus : "all";
  const rawCategory = searchParams.get(CATEGORY_PARAM);
  const categoryFilter: CampaignCategory | null = isCategory(rawCategory) ? rawCategory : null;

  const setStatusFilter = (key: StatusFilterKey) => {
    const next = new URLSearchParams(searchParams);
    if (key === "all") next.delete(STATUS_PARAM);
    else next.set(STATUS_PARAM, key);
    setSearchParams(next);
  };

  const setCategoryFilter = (value: CampaignCategory | null) => {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(CATEGORY_PARAM);
    else next.set(CATEGORY_PARAM, value);
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
    const q = foldForSearch(debouncedQuery.trim());
    // 정렬은 서버가 이미 적용(모집중→임시저장→모집 완료→모집 종료). 여기선 필터만.
    return cards.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== null && c.category !== categoryFilter) return false;
      if (q && !foldForSearch(`${c.brand} ${c.name}`).includes(q)) return false;
      return true;
    });
  }, [cards, statusFilter, categoryFilter, debouncedQuery]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("nav.items.campaigns")}</h1>
        <p className={styles.subtitle}>{t("pages.campaigns.subtitle")}</p>
      </div>

      <div className={styles.toolbar}>
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
            onChange={setCategoryFilter}
          />
          <SingleSelectFilterChip
            emptyLabel={t("domains.application.applicants.statusFilter.chipEmpty")}
            labelPrefix={t("domains.application.applicants.statusFilter.prefix")}
            popoverTitle={t("pages.campaigns.statusFilterTitle")}
            options={STATUS_FILTER_CHIP_OPTIONS.map((option) => ({
              key: option.key,
              label: t(option.label),
            }))}
            value={statusFilter === "all" ? null : statusFilter}
            onChange={(value) => setStatusFilter(value ?? "all")}
          />
        </FilterChipBar>
        <div className={styles.search}>
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder={t("pages.campaigns.searchPlaceholder")}
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
          {t("pages.campaigns.newCampaign")}
        </Button>
      </div>

      {state.kind === "loading" ? (
        <div className={styles.empty}>{t("common.loading")}</div>
      ) : state.kind === "error" ? (
        <div className={styles.empty}>
          {state.message}{" "}
          <button
            type="button"
            className={`${campaignFormStyles.btn} ${campaignFormStyles.btnGhost}`}
            onClick={() => setReloadKey((k) => k + 1)}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>{t("pages.campaigns.emptyFiltered")}</div>
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
                title={<CampaignCardTitle dday={c.dday} status={c.status} category={c.category} />}
                content={
                  <CampaignCardBody
                    thumbIcon={c.thumbIcon}
                    thumbnailUrl={c.thumbnailUrl}
                    name={c.name}
                    tags={c.tags}
                    description={c.description}
                    period={c.period}
                    reward={c.reward}
                    recruits={c.recruits}
                  />
                }
                bottomAffix={
                  c.status === "draft" ? (
                    <div className={styles.cardDraftMeta}>
                      {t("pages.campaigns.lastModified", {
                        date: formatUpdatedAt(c.updatedAt),
                      })}
                    </div>
                  ) : (
                    <CampaignCardFooter
                      approved={c.approved}
                      applied={c.applied}
                      capacity={c.capacity}
                    />
                  )
                }
              />
              {openMenu && openMenu.id === c.id && (
                <CampaignActionsMenu
                  anchor={{ x: openMenu.x, y: openMenu.y }}
                  status={c.status}
                  onApplicants={() => {
                    setOpenMenu(null);
                    navigate(`/applicants?campaignId=${encodeURIComponent(c.id)}`);
                  }}
                  onEdit={() => {
                    setOpenMenu(null);
                    navigate(`/campaigns/${encodeURIComponent(c.id)}/edit`);
                  }}
                  onCopy={() => {
                    setOpenMenu(null);
                    navigate(`/campaigns/new?copyFrom=${encodeURIComponent(c.id)}`);
                  }}
                  onViewApproved={() => {
                    setOpenMenu(null);
                    setApprovedListCampaignId(c.id);
                  }}
                  onClose={() => {
                    setOpenMenu(null);
                    setCloseTargetId(c.id);
                  }}
                  onBump={() => {
                    setOpenMenu(null);
                    setBumpTargetId(c.id);
                  }}
                  onHide={() => {
                    setOpenMenu(null);
                    setHideTargetId(c.id);
                  }}
                  onUnhide={() => {
                    setOpenMenu(null);
                    setUnhideTargetId(c.id);
                  }}
                  onDelete={() => {
                    setOpenMenu(null);
                    setDeleteTargetId(c.id);
                  }}
                  onDismiss={() => setOpenMenu(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {approvedListCampaignId && (
        <ApprovedApplicantsDialog
          campaignId={approvedListCampaignId}
          onClose={() => setApprovedListCampaignId(null)}
        />
      )}

      <BumpCampaignDialog
        campaignId={bumpTargetId}
        onDone={() => {
          setBumpTargetId(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setBumpTargetId(null)}
      />

      <CloseCampaignDialog
        campaignId={closeTargetId}
        status={cards.find((c) => c.id === closeTargetId)?.status ?? "recruit"}
        onDone={() => {
          setCloseTargetId(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setCloseTargetId(null)}
      />

      <HideCampaignDialog
        campaignId={hideTargetId}
        status={cards.find((c) => c.id === hideTargetId)?.status ?? "done"}
        onDone={() => {
          setHideTargetId(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setHideTargetId(null)}
      />

      <UnhideCampaignDialog
        campaignId={unhideTargetId}
        onDone={() => {
          setUnhideTargetId(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setUnhideTargetId(null)}
      />

      <DeleteCampaignDialog
        campaignId={deleteTargetId}
        onDone={() => {
          setDeleteTargetId(null);
          setReloadKey((k) => k + 1);
        }}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
