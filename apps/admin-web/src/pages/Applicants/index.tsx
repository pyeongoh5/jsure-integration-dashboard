import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { listCampaigns } from "@/lib/campaigns";
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

const INITIAL: Applicant[] = [
  {
    id: "a1",
    name: "유나",
    handle: "yuna_daily",
    campaign: "라이프스토어 그린 프로젝트",
    media: ["ig", "tt"],
    followers: 842_000,
    engagementRate: 6.2,
    appliedAt: "2시간 전",
    status: "pending",
  },
  {
    id: "a2",
    name: "서아",
    handle: "seoa_style",
    campaign: "비오데르마 세븀 스킨 리파이너",
    media: ["ig"],
    followers: 356_000,
    engagementRate: 7.4,
    appliedAt: "4시간 전",
    status: "pending",
  },
  {
    id: "a3",
    name: "태윤",
    handle: "taeyun_fit",
    campaign: "밀러 비주 리페어",
    media: ["ig", "yt", "x"],
    followers: 412_000,
    engagementRate: 6.9,
    appliedAt: "5시간 전",
    status: "pending",
  },
  {
    id: "a4",
    name: "우성",
    handle: "woosung.kr",
    campaign: "라이프스토어 그린 프로젝트",
    media: ["tt"],
    followers: 128_000,
    engagementRate: 11.4,
    appliedAt: "어제",
    status: "pending",
  },
  {
    id: "a5",
    name: "예린",
    handle: "yerin_diary",
    campaign: "아디다스 러닝 페스티벌",
    media: ["ig", "x"],
    followers: 684_000,
    engagementRate: 7.8,
    appliedAt: "어제",
    status: "pending",
  },
  {
    id: "a6",
    name: "동현",
    handle: "donghyun.gym",
    campaign: "아디다스 러닝 페스티벌",
    media: ["yt", "ig"],
    followers: 892_000,
    engagementRate: 8.6,
    appliedAt: "어제",
    status: "pending",
  },
  {
    id: "a7",
    name: "하린",
    handle: "harin.travel",
    campaign: "올리브영 올영픽 6월",
    media: ["ig", "yt", "tt"],
    followers: 1_800_000,
    engagementRate: 9.3,
    appliedAt: "2일 전",
    status: "pending",
  },
  {
    id: "a8",
    name: "지윤",
    handle: "jiyoon_makeup",
    campaign: "올리브영 올영픽 6월",
    media: ["yt", "x"],
    followers: 2_100_000,
    engagementRate: 5.2,
    appliedAt: "2일 전",
    status: "pending",
  },
  {
    id: "a9",
    name: "민준",
    handle: "minjun.daily",
    campaign: "스타벅스 프라푸치노 서머",
    media: ["x"],
    followers: 94_000,
    engagementRate: 12.1,
    appliedAt: "3일 전",
    status: "pending",
  },
  {
    id: "a10",
    name: "수아",
    handle: "sua_kpop",
    campaign: "올리브영 올영픽 6월",
    media: ["tt", "ig", "yt", "x"],
    followers: 3_400_000,
    engagementRate: 4.7,
    appliedAt: "3일 전",
    status: "pending",
  },
];

type PendingAction = { type: "approve" | "reject"; applicant: Applicant };

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const [tab, setTab] = useState<ApplicantStatus>("pending");
  const [items, setItems] = useState<Applicant[]>(INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);

  // Campaigns (non-closed) — for filter dropdown + title resolution
  const [campaignOptions, setCampaignOptions] = useState<CampaignOption[]>([]);
  const [campaignTitleById, setCampaignTitleById] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    listCampaigns()
      .then((rows) => {
        if (cancelled) return;
        const titles = new Map(rows.map((c) => [c.id, c.title] as const));
        setCampaignTitleById(titles);
        setCampaignOptions(
          rows
            .filter((c) => c.closedAt === null)
            .map((c) => ({ id: c.id, title: c.title })),
        );
      })
      .catch(() => {
        // Leave empty on failure; chip falls back to raw ID.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCampaignId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("campaignId", id);
    else next.delete("campaignId");
    setSearchParams(next);
  };

  const counts: StatusCounts = useMemo(
    () =>
      items.reduce(
        (acc, a) => {
          acc[a.status] += 1;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0 } as StatusCounts,
      ),
    [items],
  );

  const visible = useMemo(
    () =>
      items.filter((a) => {
        if (a.status !== tab) return false;
        if (mediaFilter.size > 0 && !a.media.some((m) => mediaFilter.has(m))) {
          return false;
        }
        if (minFollowers !== null && a.followers < minFollowers) return false;
        // campaignId filter against mock data uses the campaign title resolved from id
        if (campaignId) {
          const title = campaignTitleById.get(campaignId);
          if (title && a.campaign !== title) return false;
        }
        return true;
      }),
    [items, tab, mediaFilter, minFollowers, campaignId, campaignTitleById],
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

  function confirmAction() {
    if (!pending) return;
    const nextStatus: ApplicantStatus =
      pending.type === "approve" ? "approved" : "rejected";
    setItems((prev) =>
      prev.map((a) =>
        a.id === pending.applicant.id ? { ...a, status: nextStatus } : a,
      ),
    );
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pending.applicant.id);
      return next;
    });
    setPending(null);
  }

  function undo(a: Applicant) {
    setItems((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, status: "pending" } : x)),
    );
  }

  return (
    <div className="apl">
      <div className="apl__header">
        <h1 className="apl__title">응모자 관리</h1>
        <p className="apl__subtitle">
          검토 대기 {counts.pending}건 · 평균 처리 시간 4시간
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
        campaignLabel={campaignId ? (campaignTitleById.get(campaignId) ?? null) : null}
        campaignOptions={campaignOptions}
        onCampaignChange={setCampaignId}
        mediaFilter={mediaFilter}
        onMediaChange={setMediaFilter}
        minFollowers={minFollowers}
        onMinFollowersChange={setMinFollowers}
      />

      <ApplicantTable
        items={visible}
        selected={selected}
        onToggleAll={toggleAll}
        onToggleOne={toggleOne}
        onApprove={(a) => setPending({ type: "approve", applicant: a })}
        onReject={(a) => setPending({ type: "reject", applicant: a })}
        onUndo={undo}
      />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.type === "approve" ? "응모를 승인할까요?" : "응모를 반려할까요?"}
        subtitle={
          pending
            ? `${pending.applicant.name}(@${pending.applicant.handle}) — ${pending.applicant.campaign}`
            : undefined
        }
        confirmLabel={pending?.type === "approve" ? "승인" : "반려"}
        cancelLabel="취소"
        tone={pending?.type === "approve" ? "primary" : "danger"}
        onConfirm={confirmAction}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
