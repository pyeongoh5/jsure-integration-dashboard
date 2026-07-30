import { deleteCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function DeleteCampaignDialog(props: CampaignActionDialogProps) {
  return (
    <CampaignActionDialog
      {...props}
      title="캠페인 삭제"
      description="진행중인 캠페인이 종료와 함께 삭제되며, 다시 되돌릴 수 없어요."
      confirmLabel="삭제"
      busyLabel="삭제 중…"
      failureMessage="삭제에 실패했습니다."
      run={deleteCampaign}
    />
  );
}
