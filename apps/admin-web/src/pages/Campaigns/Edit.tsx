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
import { useT } from "@/lib/i18n";
import styles from "./Campaigns.module.css";

export function CampaignEdit() {
  const t = useT();
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
        <div className={styles.empty}>{t("domains.campaign.errors.invalidPath")}</div>
      </div>
    );
  }
  if (state.kind === "loading") {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>{t("common.loading")}</div>
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
            {t("common.retry")}
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
            {isDraft
              ? t("pages.campaigns.edit.draftTitle")
              : t("domains.campaign.actionsMenu.edit")}
          </h1>
          <p className={styles.subtitle}>
            {isDraft
              ? t("pages.campaigns.edit.draftSubtitle")
              : t("pages.campaigns.edit.subtitle")}
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
          {t("domains.campaign.actionsMenu.copy")}
        </Button>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel={
          isDraft ? t("pages.campaigns.create") : t("pages.campaigns.edit.submitSave")
        }
        onSubmit={handleSubmit}
        onSaveDraft={isDraft ? handleSaveDraft : undefined}
        onCancel={() => navigate("/campaigns")}
        selfCampaignId={id}
      />
    </div>
  );
}
