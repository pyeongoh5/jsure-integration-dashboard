import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import type { CampaignStatus } from "../types";
import { closeCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

/** 종료 메뉴는 항상 열리고, 조건이 안 맞으면 이유를 안내한다. */
const NOT_ALLOWED_MESSAGE_KEY: Record<CampaignStatus, AdminTranslationKey | null> = {
  recruit: null,
  full: null,
  done: "domains.campaign.dialogs.close.notAllowedDone",
  draft: "domains.campaign.dialogs.close.notAllowedDraft",
  hidden: "domains.campaign.dialogs.close.notAllowedHidden",
};

type Props = CampaignActionDialogProps & { status: CampaignStatus };

export function CloseCampaignDialog({ status, ...props }: Props) {
  const t = useT();
  const notAllowedKey = NOT_ALLOWED_MESSAGE_KEY[status];
  return (
    <CampaignActionDialog
      {...props}
      title={t("domains.campaign.dialogs.close.title")}
      description={
        notAllowedKey ? t(notAllowedKey) : t("domains.campaign.dialogs.close.description")
      }
      confirmLabel={t("domains.campaign.dialogs.close.confirm")}
      busyLabel={t("domains.campaign.dialogs.close.busy")}
      confirmDisabled={notAllowedKey !== null}
      failureMessage={t("domains.campaign.dialogs.close.failure")}
      run={closeCampaign}
    />
  );
}
