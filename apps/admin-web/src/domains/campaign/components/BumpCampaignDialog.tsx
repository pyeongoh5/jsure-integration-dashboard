import { bumpCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

export function BumpCampaignDialog(props: CampaignActionDialogProps) {
  return (
    <CampaignActionDialog
      {...props}
      title="캠페인 끌어올리기"
      description="인플루언서 캠페인 목록에서 같은 상태 그룹 내 최상단으로 올립니다. 이후 새 캠페인이 생기면 자연스럽게 다시 밀려납니다."
      confirmLabel="끌어올리기"
      busyLabel="처리 중…"
      tone="primary"
      failureMessage="끌어올리기에 실패했습니다."
      run={bumpCampaign}
    />
  );
}
