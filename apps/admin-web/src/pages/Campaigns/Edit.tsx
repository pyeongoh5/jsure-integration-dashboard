import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import { CampaignForm, getCampaign, updateCampaign } from "@/domains/campaign";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; initial: Values }
  | { kind: "error"; message: string };

export function CampaignEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setState({ kind: "error", message: "잘못된 경로입니다." });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    getCampaign(id)
      .then((res) => {
        if (cancelled) return;
        const initial: Values = {
          title: res.title,
          rewardJpy: res.rewardJpy,
          recruitStartDate: res.recruitStartDate,
          recruitEndDate: res.recruitEndDate,
          postingPeriodDays: res.postingPeriodDays,
          snsRecruits: res.snsRecruits,
          productSummary: res.productSummary,
          productDetailUrl: res.productDetailUrl,
          guideline: res.guideline,
          referenceMediaUrls: res.referenceMediaUrls,
          cautions: res.cautions,
          thumbnailUrl: res.thumbnailUrl,
          excludedCampaignIds: res.excludedCampaignIds,
        };
        setState({ kind: "ready", initial });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            err instanceof Error ? err.message : "캠페인을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const handleSubmit = async (values: Values) => {
    if (!id) return;
    await updateCampaign(id, values);
    navigate("/campaigns");
  };

  if (state.kind === "loading") {
    return <div className="cmp"><div className="cmp__empty">불러오는 중…</div></div>;
  }
  if (state.kind === "error") {
    return (
      <div className="cmp">
        <div className="cmp__empty">
          {state.message}{" "}
          <button
            type="button"
            className="cf__btn cf__btn--ghost"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cmp">
      <div className="cmp__header">
        <h1 className="cmp__title">캠페인 수정</h1>
        <p className="cmp__subtitle">캠페인 정보를 수정하세요.</p>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel="수정 저장"
        onSubmit={handleSubmit}
        onCancel={() => navigate("/campaigns")}
        selfCampaignId={id}
      />
    </div>
  );
}
