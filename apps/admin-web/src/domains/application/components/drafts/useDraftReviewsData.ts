import { useEffect, useMemo, useState } from "react";
import type { AdminSubmittedPost } from "@jsure/shared";
import { listSubmittedPosts } from "../draftsApi";
import { countByTab, toDraftReview } from "./draftTransform";
import type { DraftReview, DraftReviewCounts } from "./types";

export type DraftReviewsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminSubmittedPost[] }
  | { kind: "error"; message: string };

export type UseDraftReviewsDataResult = {
  state: DraftReviewsLoadState;
  drafts: DraftReview[];
  counts: DraftReviewCounts;
  reload: () => void;
};

export function useDraftReviewsData(): UseDraftReviewsDataResult {
  const [state, setState] = useState<DraftReviewsLoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listSubmittedPosts()
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "초안 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const now = useMemo(() => new Date(), [state]);

  const drafts = useMemo<DraftReview[]>(() => {
    if (state.kind !== "ready") return [];
    return state.rows.map((post) => toDraftReview(post, now));
  }, [state, now]);

  const counts = useMemo(() => countByTab(drafts), [drafts]);

  return {
    state,
    drafts,
    counts,
    reload: () => setReloadKey((current) => current + 1),
  };
}
