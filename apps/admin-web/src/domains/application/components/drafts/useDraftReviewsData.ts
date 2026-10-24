import { useEffect, useMemo, useState } from "react";
import type { AdminSubmission } from "@jsure/shared";
import { translate } from "@i18n/admin";
import { getStoredLanguage, useLanguage } from "@/lib/i18n";
import { listSubmissions } from "../draftsApi";
import { toDraftReview } from "./draftTransform";
import type { DraftReview } from "./types";

export type DraftReviewsLoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminSubmission[] }
  | { kind: "error"; message: string };

export type UseDraftReviewsDataResult = {
  state: DraftReviewsLoadState;
  drafts: DraftReview[];
  reload: () => void;
};

export function useDraftReviewsData(): UseDraftReviewsDataResult {
  const { language } = useLanguage();
  const [state, setState] = useState<DraftReviewsLoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // 재조회 중에는 이전 목록을 그대로 둔다 — 로딩 화면으로 바꾸면 갱신할 때마다
    // 표가 통째로 사라졌다 나타난다(깜빡임). 로딩은 보여줄 게 없는 첫 로드뿐.
    setState((current) =>
      current.kind === "ready" ? current : { kind: "loading" },
    );
    listSubmissions()
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
              : translate(
                  "domains.application.drafts.errors.loadFailed",
                  getStoredLanguage(),
                ),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const now = useMemo(() => new Date(), [state]);

  const drafts = useMemo<DraftReview[]>(() => {
    if (state.kind !== "ready") return [];
    return state.rows.map((submission) => toDraftReview(submission, now, language));
  }, [state, now, language]);

  return {
    state,
    drafts,
    reload: () => setReloadKey((current) => current + 1),
  };
}
