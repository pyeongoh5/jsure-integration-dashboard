import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui";
import {
  useJwinCampaignsData,
  JwinCampaignDeleteDialog,
  JwinCampaignTable,
  type JwinCampaignRow,
} from "@/components/JwinCampaigns";
import { useT } from "@/lib/i18n";
import styles from "./Jwin.module.css";

export function JwinCampaigns() {
  const t = useT();
  const navigate = useNavigate();
  const { state, rows, reload } = useJwinCampaignsData();
  const [deleteTarget, setDeleteTarget] = useState<JwinCampaignRow | null>(null);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{t("jwin.campaign.listTitle")}</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready"
              ? t("jwin.common.countItems", { count: rows.length })
              : t("jwin.common.loading")}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => navigate("/jwin/campaigns/new")}
          iconLeft={<i className="fa-solid fa-plus" aria-hidden="true" />}
        >
          {t("jwin.campaign.create")}
        </Button>
      </div>

      <div className={styles.card}>
        {state.kind === "loading" ? (
          <div className={styles.empty}>{t("jwin.common.loading")}</div>
        ) : state.kind === "error" ? (
          <div className={styles.empty}>{state.message}</div>
        ) : (
          <JwinCampaignTable
            rows={rows}
            onRowClick={(id) => navigate(`/jwin/campaigns/${id}`)}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      {deleteTarget && (
        <JwinCampaignDeleteDialog
          campaignId={deleteTarget.id}
          brandName={deleteTarget.name}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
