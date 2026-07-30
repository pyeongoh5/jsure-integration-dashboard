import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CampaignForm as Values } from "@jsure/shared";
import { Button } from "@/components/ui";
import {
  CampaignForm,
  campaignFormStyles,
  publishCampaignDraft,
  updateCampaign,
  updateCampaignDraft,
  useCampaignFormInitial,
} from "@/domains/campaign";
import styles from "./Campaigns.module.css";

export function CampaignEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const state = useCampaignFormInitial(
    id ? { kind: "edit", id } : { kind: "empty" },
    reloadKey,
  );

  if (!id) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>잘못된 경로입니다.</div>
      </div>
    );
  }
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

  // 임시저장은 "생성" 이 곧 발행이고, 계속 임시저장으로 남겨둘 수도 있다.
  const isDraft = state.campaign?.publishState === "DRAFT";

  const handleSubmit = async (values: Values) => {
    if (isDraft) await publishCampaignDraft(id, values);
    else await updateCampaign(id, values);
    navigate("/campaigns");
  };

  const handleSaveDraft = async (values: Values) => {
    await updateCampaignDraft(id, values);
    navigate("/campaigns");
  };

  return (
    <div className={styles.root}>
      <div className={`${styles.header} ${styles.headerRow}`}>
        <div>
          <h1 className={styles.title}>
            {isDraft ? "임시저장 캠페인" : "캠페인 수정"}
          </h1>
          <p className={styles.subtitle}>
            {isDraft
              ? "이어서 작성한 뒤 생성하거나 임시저장으로 남겨두세요."
              : "캠페인 정보를 수정하세요."}
          </p>
        </div>
        {/* 같은 내용으로 새 캠페인을 만들 때 — 이 캠페인은 그대로 남는다. */}
        <Button
          variant="secondary"
          size="md"
          onClick={() =>
            navigate(`/campaigns/new?copyFrom=${encodeURIComponent(id)}`)
          }
        >
          캠페인 복사
        </Button>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel={isDraft ? "생성" : "수정 저장"}
        onSubmit={handleSubmit}
        onSaveDraft={isDraft ? handleSaveDraft : undefined}
        onCancel={() => navigate("/campaigns")}
        selfCampaignId={id}
      />
    </div>
  );
}
