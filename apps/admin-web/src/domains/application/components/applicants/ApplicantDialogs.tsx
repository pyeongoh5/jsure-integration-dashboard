import { ApplicantApproveDialog } from "./ApplicantApproveDialog";
import { ApplicantDeliverDialog } from "./ApplicantDeliverDialog";
import { ApplicantRejectDialog } from "./ApplicantRejectDialog";
import { ApplicantShipDialog } from "./ApplicantShipDialog";
import { ApplicantUndoDialog } from "./ApplicantUndoDialog";
import { ForceCancelDialog } from "../ForceCancelDialog";
import { useT } from "@/lib/i18n";
import { APPLICANT_STATUS_LABEL } from "./types";
import type { ConfirmInput, PendingAction } from "./useApplicantMutations";

type Props = {
  pending: PendingAction | null;
  mutating: boolean;
  error: string | null;
  onConfirm: (input?: ConfirmInput) => void;
  onCancel: () => void;
};

export function ApplicantDialogs({
  pending,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  if (!pending) return null;

  const common = {
    applicant: pending.applicant,
    mutating,
    error,
    onCancel,
  };

  switch (pending.type) {
    case "approve":
      return <ApplicantApproveDialog {...common} onConfirm={() => onConfirm()} />;
    case "reject":
      return (
        <ApplicantRejectDialog
          {...common}
          onConfirm={(reason) => onConfirm(reason)}
        />
      );
    case "undo":
      return <ApplicantUndoDialog {...common} onConfirm={() => onConfirm()} />;
    case "ship":
      return (
        <ApplicantShipDialog
          {...common}
          onConfirm={(trackingCarrier, trackingNumber) =>
            onConfirm({ trackingCarrier, trackingNumber })
          }
        />
      );
    case "deliver":
      return <ApplicantDeliverDialog {...common} onConfirm={() => onConfirm()} />;
    case "forceCancel":
      return (
        <ForceCancelDialog
          influencerName={pending.applicant.name}
          handle={pending.applicant.handle}
          campaignTitle={pending.applicant.campaign}
          statusLabel={t(APPLICANT_STATUS_LABEL[pending.applicant.status])}
          mutating={mutating}
          error={error}
          onConfirm={(reason) => onConfirm(reason)}
          onCancel={onCancel}
        />
      );
  }
}
