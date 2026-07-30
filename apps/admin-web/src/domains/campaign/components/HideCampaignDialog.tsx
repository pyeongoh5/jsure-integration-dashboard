import type { CampaignStatus } from "../types";
import { hideCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

/** 비공개 메뉴는 항상 열리고, 조건이 안 맞으면 이유를 안내한다. */
const NOT_ALLOWED_MESSAGE: Record<CampaignStatus, string | null> = {
  recruit: "모집중인 캠페인은 비공개로 전환할 수 없습니다. 먼저 캠페인을 종료해 주세요.",
  full: null,
  done: null,
  draft: "임시저장 캠페인은 아직 인플루언서에게 노출되지 않습니다.",
  hidden: null,
};

type Props = CampaignActionDialogProps & { status: CampaignStatus };

export function HideCampaignDialog({ status, ...props }: Props) {
  const notAllowed = NOT_ALLOWED_MESSAGE[status];
  return (
    <CampaignActionDialog
      {...props}
      title="캠페인 비공개"
      description={notAllowed ?? "비공개하면 캠페인이 더 이상 보이지 않습니다."}
      confirmLabel="비공개"
      busyLabel="처리 중…"
      confirmDisabled={notAllowed !== null}
      failureMessage="비공개 전환에 실패했습니다."
      run={hideCampaign}
    />
  );
}
