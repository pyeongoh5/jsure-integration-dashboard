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
import { useT } from "@/lib/i18n";
import styles from "./Campaigns.module.css";

export function CampaignNew() {
  const t = useT();
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
        <h1 className="cmp__title">{t("pages.campaigns.new.title")}</h1>
        <p className="cmp__subtitle">
          {copyFrom
            ? t("pages.campaigns.new.copySubtitle")
            : t("pages.campaigns.new.subtitle")}
        </p>
      </div>
      <CampaignForm
        initialValue={state.initial}
        submitLabel={t("pages.campaigns.create")}
        onSubmit={handleSubmit}
        onSaveDraft={handleSaveDraft}
        initialThumbnail={copiedThumbnail}
        onCancel={() => navigate("/campaigns")}
      />
    </div>
  );
}
