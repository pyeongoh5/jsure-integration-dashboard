import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import {
  CampaignForm,
  campaignFormStyles,
  createCampaign,
  createCampaignDraft,
  useCampaignFormInitial,
} from "@/domains/campaign";
import styles from "./Campaigns.module.css";

export function CampaignNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [reloadKey, setReloadKey] = useState(0);
  const copyFrom = searchParams.get("copyFrom");
  const state = useCampaignFormInitial(
    copyFrom ? { kind: "copy", id: copyFrom } : { kind: "empty" },
    reloadKey,
  );

  const handleSubmit = async (values: Values) => {
    await createCampaign(values);
    navigate("/campaigns");
  };

  const handleSaveDraft = async (values: Values) => {
    await createCampaignDraft(values);
    navigate("/campaigns");
  };

  if (state.kind === "loading") {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>불러오는 중…</div>
      </div>
    );
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

  // 복사 원본의 썸네일은 저장 키를 그대로 물려받아야 새 캠페인에도 붙는다.
  const copiedThumbnail =
    copyFrom && state.campaign?.thumbnailObjectKey && state.campaign.thumbnailUrl
      ? {
          objectKey: state.campaign.thumbnailObjectKey,
          viewUrl: state.campaign.thumbnailUrl,
        }
      : undefined;

  return (
    <div className="cmp">
      <div className="cmp__header">
        <h1 className="cmp__title">캠페인 만들기</h1>
        <p className="cmp__subtitle">
          {copyFrom
            ? "복사한 내용을 확인하고 모집 기간을 입력하세요."
            : "새 캠페인 정보를 입력하세요."}
        </p>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel="생성"
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        initialThumbnail={copiedThumbnail}
        onCancel={() => navigate("/campaigns")}
      />
    </div>
  );
}
