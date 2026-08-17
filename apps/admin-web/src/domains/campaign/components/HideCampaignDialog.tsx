import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import type { CampaignStatus } from "../types";
import { hideCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

/** 비공개 메뉴는 항상 열리고, 조건이 안 맞으면 이유를 안내한다. */
const NOT_ALLOWED_MESSAGE_KEY: Record<CampaignStatus, AdminTranslationKey | null> = {
  recruit: "domains.campaign.dialogs.hide.notAllowedRecruit",
  full: null,
  done: null,
  draft: "domains.campaign.dialogs.hide.notAllowedDraft",
  hidden: null,
};

type Props = CampaignActionDialogProps & { status: CampaignStatus };

export function HideCampaignDialog({ status, ...props }: Props) {
  const t = useT();
  const notAllowedKey = NOT_ALLOWED_MESSAGE_KEY[status];
  return (
    <CampaignActionDialog
      {...props}
      title={t("domains.campaign.dialogs.hide.title")}
      description={
        notAllowedKey ? t(notAllowedKey) : t("domains.campaign.dialogs.hide.description")
      }
      confirmLabel={t("domains.campaign.dialogs.hide.confirm")}
      busyLabel={t("domains.campaign.dialogs.processing")}
      confirmDisabled={notAllowedKey !== null}
      failureMessage={t("domains.campaign.dialogs.hide.failure")}
      run={hideCampaign}
    />
  );
}
