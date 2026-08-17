import { useT } from "@/lib/i18n";
import { bumpCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function BumpCampaignDialog(props: CampaignActionDialogProps) {
  const t = useT();
  return (
    <CampaignActionDialog
      {...props}
      title={t("domains.campaign.dialogs.bump.title")}
      description={t("domains.campaign.dialogs.bump.description")}
      confirmLabel={t("domains.campaign.dialogs.bump.confirm")}
      busyLabel={t("domains.campaign.dialogs.processing")}
      tone="primary"
      failureMessage={t("domains.campaign.dialogs.bump.failure")}
      run={bumpCampaign}
    />
  );
}
