import { useState } from "react";
import { translate } from "@i18n/admin";
import { extractApiErrorMessage } from "@/lib/api";
import { getStoredLanguage } from "@/lib/i18n";
import {
  approveApplication,
  deliverApplication,
  rejectApplication,
  shipApplication,
  undoApplication,
} from "../api";
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

function extractErrorMessage(err: unknown): string {
  return extractApiErrorMessage(
    err,
    translate(
      "domains.application.applicants.errors.mutationFailed",
      getStoredLanguage(),
    ),
  );
}

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
          // 응모 반려 사유는 선택 입력.
          const trimmed = typeof input === "string" ? input.trim() : "";
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
            setError(
              translate(
                "domains.application.applicants.errors.trackingRequired",
                getStoredLanguage(),
              ),
            );
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
      setError(extractErrorMessage(err));
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
