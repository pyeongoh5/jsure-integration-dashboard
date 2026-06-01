import { useState } from "react";
import {
  approveApplication,
  deliverApplication,
  rejectApplication,
  shipApplication,
  undoApplication,
} from "@/lib/applications";
import type { Applicant } from "./types";

export type PendingActionType =
  | "approve"
  | "reject"
  | "undo"
  | "ship"
  | "deliver";

export type PendingAction = {
  type: PendingActionType;
  applicant: Applicant;
};

export type UseApplicantMutationsResult = {
  pending: PendingAction | null;
  mutating: boolean;
  error: string | null;
  openApprove: (applicant: Applicant) => void;
  openReject: (applicant: Applicant) => void;
  openUndo: (applicant: Applicant) => void;
  openShip: (applicant: Applicant) => void;
  openDeliver: (applicant: Applicant) => void;
  cancel: () => void;
  confirm: (input?: ConfirmInput) => Promise<boolean>;
};

export type ConfirmInput =
  | string
  | { trackingCarrier: string; trackingNumber: string };

export function useApplicantMutations(
  onMutated: () => void,
): UseApplicantMutationsResult {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setPending(null);
    setError(null);
  };

  const open = (type: PendingActionType) => (applicant: Applicant) => {
    setError(null);
    setPending({ type, applicant });
  };

  const confirm = async (input?: ConfirmInput): Promise<boolean> => {
    if (!pending || mutating) return false;
    setMutating(true);
    setError(null);
    try {
      const id = pending.applicant.id;
      switch (pending.type) {
        case "approve":
          await approveApplication(id);
          break;
        case "reject": {
          const trimmed = typeof input === "string" ? input.trim() : "";
          if (trimmed === "") {
            setError("반려 사유를 입력하세요.");
            return false;
          }
          await rejectApplication(id, trimmed);
          break;
        }
        case "undo":
          await undoApplication(id);
          break;
        case "ship": {
          if (
            typeof input !== "object" ||
            input === null ||
            !input.trackingCarrier?.trim() ||
            !input.trackingNumber?.trim()
          ) {
            setError("택배사와 운송장 번호를 입력하세요.");
            return false;
          }
          await shipApplication(
            id,
            input.trackingCarrier.trim(),
            input.trackingNumber.trim(),
          );
          break;
        }
        case "deliver":
          await deliverApplication(id);
          break;
      }
      setPending(null);
      onMutated();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
      return false;
    } finally {
      setMutating(false);
    }
  };

  return {
    pending,
    mutating,
    error,
    openApprove: open("approve"),
    openReject: open("reject"),
    openUndo: open("undo"),
    openShip: open("ship"),
    openDeliver: open("deliver"),
    cancel,
    confirm,
  };
}
