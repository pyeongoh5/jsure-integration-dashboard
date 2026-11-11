import { useState } from "react";
import { translate } from "@i18n/admin";
import { getStoredLanguage } from "@/lib/i18n";
import {
  approveSubmission,
  forceCancelApplication,
  rejectSubmission,
  settleSubmission,
  undoSubmissionReview,
} from "../draftsApi";
import { toCancelInput, type CancelInput } from "../../cancelReason";
import type { DraftReview } from "./types";

export type PendingDraftActionType = "approve" | "reject" | "undo" | "forceCancel";

/** 승인은 가구매 환급액(number), 반려는 사유(string), 강제취소는 CancelInput 을 넘긴다. */
export type DraftConfirmInput = string | number | CancelInput;

export type PendingDraftAction = {
  type: PendingDraftActionType;
  draft: DraftReview;
};

export type UseDraftMutationsResult = {
  pending: PendingDraftAction | null;
  mutating: boolean;
  error: string | null;
  openApprove: (draft: DraftReview) => void;
  openReject: (draft: DraftReview) => void;
  openUndo: (draft: DraftReview) => void;
  openForceCancel: (draft: DraftReview) => void;
  settle: (draft: DraftReview) => Promise<boolean>;
  cancel: () => void;
  confirm: (input?: DraftConfirmInput) => Promise<boolean>;
};

export function useDraftMutations(
  onMutated: () => void,
): UseDraftMutationsResult {
  const [pending, setPending] = useState<PendingDraftAction | null>(null);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setPending(null);
    setError(null);
  };

  const open = (type: PendingDraftActionType) => (draft: DraftReview) => {
    setError(null);
    setPending({ type, draft });
  };

  const confirm = async (input?: DraftConfirmInput): Promise<boolean> => {
    if (!pending || mutating) return false;
    setMutating(true);
    setError(null);
    try {
      const applicationId = pending.draft.id;
      switch (pending.type) {
        case "approve": {
          // 가구매만 환급액을 함께 보낸다. 다른 카테고리는 다이얼로그가 값을 주지 않는다.
          const productRefundJpy = typeof input === "number" ? input : undefined;
          if (
            pending.draft.category === "FAKE_PURCHASE" &&
            productRefundJpy === undefined
          ) {
            setError(
              translate(
                "domains.application.drafts.approveDialog.refundRequired",
                getStoredLanguage(),
              ),
            );
            return false;
          }
          await approveSubmission(applicationId, productRefundJpy);
          break;
        }
        case "reject": {
          const comment = typeof input === "string" ? input.trim() : "";
          if (comment === "") {
            setError(
              translate(
                "domains.application.drafts.rejectDialog.reasonRequired",
                getStoredLanguage(),
              ),
            );
            return false;
          }
          await rejectSubmission(applicationId, comment);
          break;
        }
        case "undo":
          await undoSubmissionReview(applicationId);
          break;
        case "forceCancel": {
          const cancelInput = toCancelInput(input);
          if (!cancelInput) {
            setError(
              translate(
                "domains.application.forceCancel.reasonRequired",
                getStoredLanguage(),
              ),
            );
            return false;
          }
          await forceCancelApplication(
            applicationId,
            cancelInput.reasonCategory,
            cancelInput.reason,
          );
          break;
        }
      }
      setPending(null);
      onMutated();
      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : translate(
              "domains.application.applicants.errors.mutationFailed",
              getStoredLanguage(),
            ),
      );
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
    openForceCancel: open("forceCancel"),
    settle: async (draft: DraftReview) => {
      try {
        await settleSubmission(draft.id);
        onMutated();
        return true;
      } catch (settleError) {
        setError(
          settleError instanceof Error
            ? settleError.message
            : translate(
                "domains.application.applicants.errors.mutationFailed",
                getStoredLanguage(),
              ),
        );
        return false;
      }
    },
    cancel,
    confirm,
  };
}
