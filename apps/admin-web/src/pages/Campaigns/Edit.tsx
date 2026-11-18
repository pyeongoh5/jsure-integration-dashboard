import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { CampaignForm as Values, CampaignResponse } from "@jsure/shared";
import { Button } from "@/components/ui";
import { getStoredUser } from "@/domains/auth";
import {
  CampaignForm,
  CampaignManagerPicker,
  campaignFormStyles,
  initialManagerIds,
  publishCampaignDraft,
  updateCampaign,
  updateCampaignDraft,
  useAdminUserOptions,
  useCampaignFormInitial,
} from "@/domains/campaign";
import { useT } from "@/lib/i18n";
import styles from "./Campaigns.module.css";

type ReadyProps = {
  id: string;
  initial: Values;
  campaign: CampaignResponse | null;
};

/**
 * 로딩이 끝난 뒤에만 마운트된다 — 그래야 담당자 선택 상태(useState)가 이미
 * 불러온 캠페인 담당자로 정확히 초기화된다. 로딩 중에 미리 마운트해 두면
 * 초기값이 빈 배열로 굳어버린다(useState 지연 초기화는 최초 마운트에만 실행).
 */
function CampaignEditReady({ id, initial, campaign }: ReadyProps) {
  const t = useT();
  const navigate = useNavigate();
  const [managerIds, setManagerIds] = useState(() =>
    initialManagerIds("edit", campaign, getStoredUser()?.id ?? null),
  );
  const { managers, error: managersError } = useAdminUserOptions();

  // 임시저장은 "생성" 이 곧 발행이고, 계속 임시저장으로 남겨둘 수도 있다.
  const isDraft = campaign?.publishState === "DRAFT";

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
        <div className={styles.headerActions}>
          <CampaignManagerPicker
            value={managerIds}
            onChange={setManagerIds}
            managers={managers}
            error={managersError}
          />
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
      </div>
      <CampaignForm
        initialValue={initial}
        submitLabel={
          isDraft ? t("pages.campaigns.create") : t("pages.campaigns.edit.submitSave")
        }
        onSubmit={handleSubmit}
        onSaveDraft={isDraft ? handleSaveDraft : undefined}
        onCancel={() => navigate("/campaigns")}
        selfCampaignId={id}
        managerIds={managerIds}
      />
    </div>
  );
}

export function CampaignEdit() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
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

  return <CampaignEditReady id={id} initial={state.initial} campaign={state.campaign} />;
}
