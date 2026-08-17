import { useT } from "@/lib/i18n";
import { unhideCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function UnhideCampaignDialog(props: CampaignActionDialogProps) {
  const t = useT();
  return (
    <CampaignActionDialog
      {...props}
      title={t("domains.campaign.dialogs.unhide.title")}
      description={t("domains.campaign.dialogs.unhide.description")}
      confirmLabel={t("domains.campaign.dialogs.unhide.confirm")}
      busyLabel={t("domains.campaign.dialogs.processing")}
      tone="primary"
      failureMessage={t("domains.campaign.dialogs.unhide.failure")}
      run={unhideCampaign}
    />
  );
}
