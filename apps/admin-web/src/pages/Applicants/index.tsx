import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApplicantTabs } from "@/components/Applicants/ApplicantTabs";
import { ApplicantFilters } from "@/components/Applicants/ApplicantFilters";
import { ApplicantTable } from "@/components/Applicants/ApplicantTable";
import { ApplicantConfirmDialog } from "@/components/Applicants/ApplicantConfirmDialog";
import { useApplicantsData } from "@/components/Applicants/useApplicantsData";
import { useCampaignOptions } from "@/components/Applicants/useCampaignOptions";
import { useApplicantMutations } from "@/components/Applicants/useApplicantMutations";
import type {
  ApplicantStatus,
  Media,
} from "@/components/Applicants/types";
import "./Applicants.css";

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const [tab, setTab] = useState<ApplicantStatus>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);

  const { state, applicants, counts, reload } = useApplicantsData(
    campaignId,
    tab,
  );
  const {
    campaignOptions,
    campaignTitleById,
    loaded: campaignsLoaded,
  } = useCampaignOptions();
  const mutations = useApplicantMutations(reload);

  const setCampaignId = (id: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("campaignId", id);
    else next.delete("campaignId");
    setSearchParams(next);
  };

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
        campaignsLoaded={campaignsLoaded}
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
          onToggleAll={(checked) =>
            setSelected(checked ? new Set(visible.map((v) => v.id)) : new Set())
          }
          onToggleOne={(id) =>
            setSelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onApprove={mutations.openApprove}
          onReject={mutations.openReject}
          onUndo={mutations.undo}
        />
      )}

      <ApplicantConfirmDialog
        pending={mutations.pending}
        mutating={mutations.mutating}
        error={mutations.error}
        onConfirm={mutations.confirm}
        onCancel={mutations.cancel}
      />
    </div>
  );
}
