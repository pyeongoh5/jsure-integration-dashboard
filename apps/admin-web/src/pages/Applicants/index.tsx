import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ApplicantTabs,
  ApplicantFilters,
  ApplicantTable,
  ApplicantDialogs,
  useApplicantsData,
  useCampaignOptions,
  useApplicantMutations,
  type ApplicantStage,
  type ApplicantStatus,
  type ApplicantMedia as Media,
} from "@/domains/application";
import "./Applicants.css";

const VALID_APPLICANT_TABS: ApplicantStatus[] = ["pending", "approved", "rejected"];

function isApplicantTab(value: string | null): value is ApplicantStatus {
  return value !== null && (VALID_APPLICANT_TABS as string[]).includes(value);
}

export function Applicants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get("campaignId");
  const tab: ApplicantStatus = isApplicantTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as ApplicantStatus)
    : "pending";
  const setTab = (next: ApplicantStatus) => {
    const np = new URLSearchParams(searchParams);
    np.set("tab", next);
    setSearchParams(np);
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mediaFilter, setMediaFilter] = useState<Set<Media>>(() => new Set());
  const [minFollowers, setMinFollowers] = useState<number | null>(null);
  const [stageFilter, setStageFilter] = useState<Set<ApplicantStage>>(
    () => new Set(),
  );

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
      applicants.filter((applicant) => {
        if (applicant.status !== tab) return false;
        if (
          mediaFilter.size > 0 &&
          !applicant.media.some((media) => mediaFilter.has(media))
        ) {
          return false;
        }
        if (minFollowers !== null && applicant.followers < minFollowers)
          return false;
        if (
          tab === "approved" &&
          stageFilter.size > 0 &&
          (applicant.stage === null || !stageFilter.has(applicant.stage))
        ) {
          return false;
        }
        return true;
      }),
    [applicants, tab, mediaFilter, minFollowers, stageFilter],
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
        showStageFilter={tab === "approved"}
        stageFilter={stageFilter}
        onStageChange={setStageFilter}
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
          showStage={tab === "approved"}
          onToggleAll={(checked) =>
            setSelected(
              checked
                ? new Set(visible.map((applicant) => applicant.id))
                : new Set(),
            )
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
          onUndo={mutations.openUndo}
          onShip={mutations.openShip}
          onDeliver={mutations.openDeliver}
        />
      )}

      <ApplicantDialogs
        pending={mutations.pending}
        mutating={mutations.mutating}
        error={mutations.error}
        onConfirm={mutations.confirm}
        onCancel={mutations.cancel}
      />
    </div>
  );
}
