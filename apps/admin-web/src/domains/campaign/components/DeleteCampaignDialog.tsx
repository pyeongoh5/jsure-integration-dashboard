import { useT } from "@/lib/i18n";
import { deleteCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function DeleteCampaignDialog(props: CampaignActionDialogProps) {
  const t = useT();
  return (
    <CampaignActionDialog
      {...props}
      title={t("domains.campaign.dialogs.delete.title")}
      description={t("domains.campaign.dialogs.delete.description")}
      confirmLabel={t("domains.campaign.dialogs.delete.confirm")}
      busyLabel={t("domains.campaign.dialogs.delete.busy")}
      failureMessage={t("domains.campaign.dialogs.delete.failure")}
      run={deleteCampaign}
    />
  );
}
