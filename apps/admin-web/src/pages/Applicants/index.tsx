import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type {
  AdminApplication,
  AdminInfluencerSnsAccount,
  ApplicationStatus,
  SnsType,
} from "@jsure/shared";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { listCampaigns } from "@/lib/campaigns";
import {
  approveApplication,
  listApplications,
  rejectApplication,
  undoApplication,
} from "@/lib/applications";
import { ApplicantTabs } from "@/components/Applicants/ApplicantTabs";
import { ApplicantFilters } from "@/components/Applicants/ApplicantFilters";
import { ApplicantTable } from "@/components/Applicants/ApplicantTable";
import type {
  Applicant,
  ApplicantStatus,
  CampaignOption,
  Media,
  StatusCounts,
} from "@/components/Applicants/types";
import "./Applicants.css";

const SNS_TO_MEDIA: Record<SnsType, Media> = {
  INSTAGRAM: "ig",
  YOUTUBE: "yt",
  TIKTOK: "tt",
  X: "x",
};

const STATUS_TO_TAB: Record<ApplicationStatus, ApplicantStatus> = {
  APPLIED: "pending",
  APPROVED: "approved",
  SHIPPED: "approved",
  DELIVERED: "approved",
  COMPLETED: "approved",
  REJECTED: "rejected",
  CANCELLED: "rejected",
};

const TAB_TO_STATUSES: Record<ApplicantStatus, ApplicationStatus[]> = {
  pending: ["APPLIED"],
  approved: ["APPROVED", "SHIPPED", "DELIVERED", "COMPLETED"],
  rejected: ["REJECTED", "CANCELLED"],
};

function pickHandle(accounts: AdminInfluencerSnsAccount[]): string {
  return accounts[0]?.handle ?? "";
}

function pickFollowers(accounts: AdminInfluencerSnsAccount[]): number {
  return accounts.reduce((max, s) => Math.max(max, s.followerCount), 0);
}

function pickMedia(accounts: AdminInfluencerSnsAccount[]): Media[] {
  return accounts.map((s) => SNS_TO_MEDIA[s.snsType]);
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("ko", { numeric: "auto" });

function formatRelative(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return RELATIVE_TIME.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return RELATIVE_TIME.format(-hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return RELATIVE_TIME.format(-days, "day");
  return then.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function toApplicant(a: AdminApplication, now: Date): Applicant {
  return {
    id: a.id,
    name: a.influencer.name,
    handle: pickHandle(a.influencer.snsAccounts),
    campaign: a.campaign.title,
    media: pickMedia(a.influencer.snsAccounts),
    followers: pickFollowers(a.influencer.snsAccounts),
    engagementRate: 0,
    appliedAt: formatRelative(a.appliedAt, now),
    status: STATUS_TO_TAB[a.status],
  };
}

type PendingAction = { type: "approve" | "reject"; applicant: Applicant };

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminApplication[] }
  | { kind: "error"; message: string };

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const [tab, setTab] = useState<ApplicantStatus>("pending");
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [mutating, setMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);

  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignTitleById, setCampaignTitleById] = useState<
    Map<string, string>
  >(() => new Map());

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then((rows) => {
        if (cancelled) return;
        setCampaignTitleById(new Map(rows.map((c) => [c.id, c.title])));
        setCampaignOptions(
          rows
            .filter((c) => c.closedAt === null)
            .map((c) => ({ id: c.id, title: c.title })),
        );
      })
      .catch(() => {
        // chip falls back to raw id
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listApplications({
      campaignId: campaignId ?? undefined,
      statuses: TAB_TO_STATUSES[tab],
    })
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
              : "응모자 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, tab, reloadKey]);

  const setCampaignId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("campaignId", id);
    else next.delete("campaignId");
    setSearchParams(next);
  };

  const now = useMemo(() => new Date(), [state]);

  const applicants: Applicant[] = useMemo(() => {
    if (state.kind !== "ready") return [];
    return state.rows.map((a) => toApplicant(a, now));
  }, [state, now]);

  // Server-side filters apply campaignId + status. Counts here reflect the
  // current tab's slice — for the other tabs we don't know until the user
  // switches. Display the count for the current tab only; others as 0 unless
  // we want a separate endpoint.
  const counts: StatusCounts = useMemo(() => {
    const acc: StatusCounts = { pending: 0, approved: 0, rejected: 0 };
    for (const a of applicants) acc[a.status] += 1;
    return acc;
  }, [applicants]);

  const visible = useMemo(
    () =>
      applicants.filter((a) => {
        if (a.status !== tab) return false;
        if (mediaFilter.size > 0 && !a.media.some((m) => mediaFilter.has(m))) {
          return false;
        }
        if (minFollowers !== null && a.followers < minFollowers) return false;
        return true;
      }),
    [applicants, tab, mediaFilter, minFollowers],
  );

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(visible.map((v) => v.id)) : new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function closeDialog() {
    setPending(null);
    setRejectReason("");
    setMutationError(null);
  }

  async function confirmAction() {
    if (!pending || mutating) return;
    setMutating(true);
    setMutationError(null);
    try {
      if (pending.type === "approve") {
        await approveApplication(pending.applicant.id);
      } else {
        const reason = rejectReason.trim();
        if (reason === "") {
          setMutationError("반려 사유를 입력하세요.");
          setMutating(false);
          return;
        }
        await rejectApplication(pending.applicant.id, reason);
      }
      closeDialog();
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(pending.applicant.id);
        return next;
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMutationError(
        err instanceof Error ? err.message : "처리에 실패했습니다.",
      );
    } finally {
      setMutating(false);
    }
  }

  async function undoApplicant(a: Applicant) {
    try {
      await undoApplication(a.id);
      setReloadKey((k) => k + 1);
    } catch {
      // Best-effort; UI stays as-is.
    }
  }

  return (
    <div className="apl">
      <div className="apl__header">
        <h1 className="apl__title">응모자 관리</h1>
        <p className="apl__subtitle">
          {state.kind === "ready"
            ? `현재 탭 ${visible.length}건`
            : "불러오는 중..."}
        </p>
      </div>

      <ApplicantTabs
        value={tab}
        counts={counts}
        onChange={(next) => {
          setTab(next);
          setSelected(new Set());
        }}
      />

      <ApplicantFilters
        campaignId={campaignId}
        campaignLabel={
          campaignId ? (campaignTitleById.get(campaignId) ?? null) : null
        }
        campaignOptions={campaignOptions}
        onCampaignChange={setCampaignId}
        mediaFilter={mediaFilter}
        onMediaChange={setMediaFilter}
        minFollowers={minFollowers}
        onMinFollowersChange={setMinFollowers}
      />

      {state.kind === "loading" ? (
        <div className="apl__card">
          <div className="apl__empty">불러오는 중…</div>
        </div>
      ) : state.kind === "error" ? (
        <div className="apl__card">
          <div className="apl__empty">{state.message}</div>
        </div>
      ) : (
        <ApplicantTable
          items={visible}
          selected={selected}
          onToggleAll={toggleAll}
          onToggleOne={toggleOne}
          onApprove={(a) => {
            setMutationError(null);
            setRejectReason("");
            setPending({ type: "approve", applicant: a });
          }}
          onReject={(a) => {
            setMutationError(null);
            setRejectReason("");
            setPending({ type: "reject", applicant: a });
          }}
          onUndo={undoApplicant}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.type === "approve"
            ? "응모를 승인할까요?"
            : "응모를 반려할까요?"
        }
        subtitle={
          pending ? (
            <>
              <div>
                {pending.applicant.name}
                {pending.applicant.handle ? `(@${pending.applicant.handle})` : ""}{" "}
                — {pending.applicant.campaign}
              </div>
              {pending.type === "reject" && (
                <textarea
                  className="apl-reject-reason"
                  placeholder="반려 사유를 입력하세요"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={mutating}
                  autoFocus
                />
              )}
              {mutationError && (
                <div className="apl-mutation-error">{mutationError}</div>
              )}
            </>
          ) : undefined
        }
        confirmLabel={
          mutating
            ? "처리 중…"
            : pending?.type === "approve"
              ? "승인"
              : "반려"
        }
        cancelLabel="취소"
        tone={pending?.type === "approve" ? "primary" : "danger"}
        busy={mutating}
        onConfirm={confirmAction}
        onCancel={closeDialog}
      />
    </div>
  );
}
