import type { CampaignStatus } from "../types";
import { closeCampaign } from "../api";
import {
  CampaignActionDialog,
  type CampaignActionDialogProps,
} from "./CampaignActionDialog";

/** 종료 메뉴는 항상 열리고, 조건이 안 맞으면 이유를 안내한다. */
const NOT_ALLOWED_MESSAGE: Record<CampaignStatus, string | null> = {
  recruit: null,
  full: null,
  done: "이미 종료된 캠페인입니다.",
  draft: "임시저장 캠페인은 종료할 수 없습니다.",
  hidden: "비공개 캠페인입니다. 공개로 전환한 뒤 종료해 주세요.",
};

type Props = CampaignActionDialogProps & { status: CampaignStatus };

export function CloseCampaignDialog({ status, ...props }: Props) {
  const notAllowed = NOT_ALLOWED_MESSAGE[status];
  return (
    <CampaignActionDialog
      {...props}
      title="캠페인 종료"
      description={notAllowed ?? "진행중인 캠페인이 즉시 종료됩니다."}
      confirmLabel="종료"
      busyLabel="종료 중…"
      confirmDisabled={notAllowed !== null}
      failureMessage="종료에 실패했습니다."
      run={closeCampaign}
    />
  );
}
