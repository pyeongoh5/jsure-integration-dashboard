import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";

export type CampaignActionDialogProps = {
  /** null 이면 닫힌 상태. 대상 캠페인 id 가 곧 open 조건이다. */
  campaignId: string | null;
  /** 액션 성공 후 — 목록 갱신용. */
  onDone: () => void;
  onCancel: () => void;
};

type Props = CampaignActionDialogProps & {
  title: string;
  description: string;
  confirmLabel: string;
  busyLabel: string;
  tone?: "primary" | "danger";
  /** 실행 조건 미충족 — 안내만 보여주고 확인 버튼을 막는다. */
  confirmDisabled?: boolean;
  failureMessage: string;
  run: (campaignId: string) => Promise<unknown>;
};

/**
 * 캠페인 액션 확인 모달의 공통 골격 — 실행/대기/에러 처리만 담당한다.
 * 액션별 문구와 API 는 각 액션 컴포넌트(CloseCampaignDialog 등)가 정한다.
 */
export function CampaignActionDialog({
  campaignId,
  onDone,
  onCancel,
  title,
  description,
  confirmLabel,
  busyLabel,
  tone = "danger",
  confirmDisabled = false,
  failureMessage,
  run,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onCancel();
  };

  return (
    <ConfirmDialog
      open={campaignId !== null}
      title={title}
      subtitle={error ?? description}
      confirmLabel={busy ? busyLabel : confirmLabel}
      cancelLabel={t("common.cancel")}
      tone={tone}
      busy={busy}
      confirmDisabled={confirmDisabled}
      onConfirm={async () => {
        if (!campaignId || busy || confirmDisabled) return;
        setBusy(true);
        setError(null);
        try {
          await run(campaignId);
          onDone();
        } catch (err) {
          setError(err instanceof Error ? err.message : failureMessage);
        } finally {
          setBusy(false);
        }
      }}
      onCancel={() => {
        if (busy) return;
        close();
      }}
    />
  );
}
