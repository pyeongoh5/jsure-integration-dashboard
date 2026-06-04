import { useState } from "react";
import {
  approveSubmittedPost,
  rejectSubmittedPost,
  settleSubmittedPost,
  undoSubmittedPostReview,
} from "@/lib/draftReviews";
import type { DraftReview } from "./types";

export type PendingDraftActionType = "approve" | "reject" | "undo";

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
  settle: (draft: DraftReview) => Promise<boolean>;
  cancel: () => void;
  confirm: (input?: string) => Promise<boolean>;
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

  const confirm = async (input?: string): Promise<boolean> => {
    if (!pending || mutating) return false;
    setMutating(true);
    setError(null);
    try {
      const postId = pending.draft.id;
      switch (pending.type) {
        case "approve":
          await approveSubmittedPost(postId);
          break;
        case "reject": {
          const comment = (input ?? "").trim();
          if (comment === "") {
            setError("반려 사유를 입력하세요.");
            return false;
          }
          await rejectSubmittedPost(postId, comment);
          break;
        }
        case "undo":
          await undoSubmittedPostReview(postId);
          break;
      }
      setPending(null);
      onMutated();
      return true;
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "처리에 실패했습니다.",
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
    settle: async (draft: DraftReview) => {
      try {
        await settleSubmittedPost(draft.id);
        onMutated();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "처리에 실패했습니다.");
        return false;
      }
    },
    cancel,
    confirm,
  };
}
