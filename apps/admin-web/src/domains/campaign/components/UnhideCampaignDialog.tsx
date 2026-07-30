import { unhideCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function UnhideCampaignDialog(props: CampaignActionDialogProps) {
  return (
    <CampaignActionDialog
      {...props}
      title="캠페인 공개"
      description="공개하면 인플루언서 화면에 다시 노출됩니다."
      confirmLabel="공개"
      busyLabel="처리 중…"
      tone="primary"
      failureMessage="공개 전환에 실패했습니다."
      run={unhideCampaign}
    />
  );
}
