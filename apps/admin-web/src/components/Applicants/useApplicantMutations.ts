import { useState } from "react";
import {
  approveApplication,
  rejectApplication,
  undoApplication,
} from "@/lib/applications";
import type { Applicant } from "./types";

export type PendingAction = {
  type: "approve" | "reject";
  applicant: Applicant;
};

export type UseApplicantMutationsResult = {
  pending: PendingAction | null;
  mutating: boolean;
  error: string | null;
  openApprove: (a: Applicant) => void;
  openReject: (a: Applicant) => void;
  cancel: () => void;
  confirm: (reason?: string) => Promise<boolean>;
  undo: (a: Applicant) => Promise<void>;
};

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

  const openApprove = (a: Applicant) => {
    setError(null);
    setPending({ type: "approve", applicant: a });
  };

  const openReject = (a: Applicant) => {
    setError(null);
    setPending({ type: "reject", applicant: a });
  };

  const confirm = async (reason?: string): Promise<boolean> => {
    if (!pending || mutating) return false;
    setMutating(true);
    setError(null);
    try {
      if (pending.type === "approve") {
        await approveApplication(pending.applicant.id);
      } else {
        const trimmed = (reason ?? "").trim();
        if (trimmed === "") {
          setError("반려 사유를 입력하세요.");
          return false;
        }
        await rejectApplication(pending.applicant.id, trimmed);
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

  const undo = async (a: Applicant) => {
    try {
      await undoApplication(a.id);
      onMutated();
    } catch {
      // best-effort
    }
  };

  return {
    pending,
    mutating,
    error,
    openApprove,
    openReject,
    cancel,
    confirm,
    undo,
  };
}
