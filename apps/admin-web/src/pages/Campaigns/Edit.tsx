import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import {
  CampaignForm,
  getCampaign,
  updateCampaign,
  campaignFormStyles,
} from "@/domains/campaign";
import styles from "./Campaigns.module.css";

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
          category: res.category,
          title: res.title,
          rewardJpy: res.rewardJpy,
          recruitStartDate: res.recruitStartDate,
          recruitEndDate: res.recruitEndDate,
          postingPeriodDays: res.postingPeriodDays,
          recruits: res.recruits.filter(
            (recruit): recruit is Values["recruits"][number] =>
              recruit.subType === "INSTAGRAM" ||
              recruit.subType === "TIKTOK" ||
              recruit.subType === "X" ||
              recruit.subType === "YOUTUBE",
          ),
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
    return <div className={styles.root}><div className={styles.empty}>불러오는 중…</div></div>;
  }
  if (state.kind === "error") {
    return (
      <div className={styles.root}>
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
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <h1 className={styles.title}>캠페인 수정</h1>
        <p className={styles.subtitle}>캠페인 정보를 수정하세요.</p>
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
