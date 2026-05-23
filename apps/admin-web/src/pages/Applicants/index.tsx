import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ConfirmDialog } from "@/ui/ConfirmDialog";
import { listCampaigns } from "@/lib/campaigns";
import "./Applicants.css";

type ApplicantStatus = "pending" | "approved" | "rejected";
type Media = "ig" | "yt" | "tt" | "x";

type Applicant = {
  id: string;
  name: string;
  handle: string;
  campaign: string;
  media: Media[];
  followers: number;
  engagementRate: number;
  appliedAt: string;
  status: ApplicantStatus;
};

const MEDIA_META: Record<Media, { label: string; icon: string; cls: string }> = {
  ig: { label: "Instagram", icon: "fa-brands fa-instagram", cls: "apl-media--ig" },
  yt: { label: "YouTube", icon: "fa-brands fa-youtube", cls: "apl-media--yt" },
  tt: { label: "TikTok", icon: "fa-brands fa-tiktok", cls: "apl-media--tt" },
  x: { label: "X", icon: "fa-brands fa-x-twitter", cls: "apl-media--x" },
};

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

const TABS: { key: ApplicantStatus; label: string }[] = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "반려" },
];

const AVATAR_PALETTE = [
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

type PendingAction = { type: "approve" | "reject"; applicant: Applicant };

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignIdFilter = searchParams.get("campaignId");
  const [tab, setTab] = useState<ApplicantStatus>("pending");
  const [items, setItems] = useState<Applicant[]>(INITIAL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [campaignTitles, setCampaignTitles] = useState<Map<string, string>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!campaignIdFilter) return;
    let cancelled = false;
    listCampaigns()
      .then((rows) => {
        if (cancelled) return;
        setCampaignTitles(new Map(rows.map((c) => [c.id, c.title])));
      })
      .catch(() => {
        // Fallback to raw ID display on failure.
      });
    return () => {
      cancelled = true;
    };
  }, [campaignIdFilter]);

  const campaignFilterLabel = campaignIdFilter
    ? (campaignTitles.get(campaignIdFilter) ?? campaignIdFilter)
    : null;

  const counts = useMemo(
    () =>
      items.reduce(
        (acc, a) => {
          acc[a.status] += 1;
          return acc;
        },
        { pending: 0, approved: 0, rejected: 0 } as Record<ApplicantStatus, number>,
      ),
    [items],
  );

  const visible = useMemo(
    () => items.filter((a) => a.status === tab),
    [items, tab],
  );

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(visible.map((v) => v.id)));
    } else {
      setSelected(new Set());
    }
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

  const allChecked = visible.length > 0 && visible.every((v) => selected.has(v.id));

  return (
    <div className="apl">
      <div className="apl__header">
        <h1 className="apl__title">응모자 관리</h1>
        <p className="apl__subtitle">
          검토 대기 {counts.pending}건 · 평균 처리 시간 4시간
        </p>
      </div>

      <div className="apl__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`apl-tab ${tab === t.key ? "apl-tab--active" : ""}`}
            onClick={() => {
              setTab(t.key);
              setSelected(new Set());
            }}
          >
            {t.label}
            <span className="apl-tab__count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="apl__filters">
        {campaignIdFilter ? (
          <button
            type="button"
            className="apl-filter apl-filter--active"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.delete("campaignId");
              setSearchParams(next);
            }}
            title="필터 해제"
          >
            캠페인: {campaignFilterLabel} ✕
          </button>
        ) : (
          <button type="button" className="apl-filter">
            + 캠페인
          </button>
        )}
        <button type="button" className="apl-filter">
          + 팔로워 범위
        </button>
        <button type="button" className="apl-filter">
          + 매체
        </button>
      </div>

      <div className="apl__card">
        {visible.length === 0 ? (
          <div className="apl__empty">해당 상태의 응모자가 없습니다.</div>
        ) : (
          <table className="apl__table">
            <thead>
              <tr>
                <th className="apl-check">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th>인플루언서</th>
                <th>캠페인</th>
                <th>매체</th>
                <th>팔로워</th>
                <th>참여율</th>
                <th>응모 시각</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                return (
                  <tr key={a.id}>
                    <td className="apl-check">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleOne(a.id)}
                      />
                    </td>
                    <td>
                      <div className="apl-inf">
                        <div
                          className="apl-inf__avatar"
                          style={{ background: pickAvatarColor(a.id) }}
                        >
                          {a.name[0]}
                        </div>
                        <div>
                          <div className="apl-inf__name">{a.name}</div>
                          <div className="apl-inf__handle">@{a.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td>{a.campaign}</td>
                    <td>
                      <div className="apl-media-list">
                        {a.media.map((m) => {
                          const meta = MEDIA_META[m];
                          return (
                            <span
                              key={m}
                              className={`apl-media ${meta.cls}`}
                              title={meta.label}
                              aria-label={meta.label}
                            >
                              <i className={meta.icon} />
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="apl-num">{formatFollowers(a.followers)}</td>
                    <td className="apl-rate">{a.engagementRate.toFixed(1)}%</td>
                    <td className="apl-time">{a.appliedAt}</td>
                    <td>
                      {a.status === "pending" ? (
                        <div className="apl-actions">
                          <button
                            type="button"
                            className="apl-action apl-action--approve"
                            onClick={() => setPending({ type: "approve", applicant: a })}
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            className="apl-action apl-action--reject"
                            onClick={() => setPending({ type: "reject", applicant: a })}
                          >
                            반려
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="apl-action apl-action--undo"
                          onClick={() =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === a.id ? { ...x, status: "pending" } : x,
                              ),
                            )
                          }
                        >
                          되돌리기
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.type === "approve"
            ? "응모를 승인할까요?"
            : "응모를 반려할까요?"
        }
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
