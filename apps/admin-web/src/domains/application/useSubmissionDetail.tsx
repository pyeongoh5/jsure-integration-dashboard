import { useState, type ReactNode } from "react";
import { translate } from "@i18n/admin";
import { getStoredLanguage, useLanguage } from "@/lib/i18n";
import { fetchSubmission } from "./draftsApi";
import { toDraftReview } from "./components/drafts/draftTransform";
import { InsightDetailDialog } from "./components/drafts/InsightDetailDialog";
import type { DraftReview } from "./components/drafts/types";

type SubmissionDetail = {
  /** 응모 제출물을 불러와 상세 모달을 연다. 로딩 중 다른 호출은 무시된다. */
  open: (applicationId: string) => void;
  /** 불러오는 중인 응모 id — 버튼 비활성·문구 전환에 사용. */
  loadingId: string | null;
  /** 열려 있을 때만 렌더되는 상세 모달. 호출부에서 한 번 렌더한다. */
  dialog: ReactNode;
};

/**
 * 응모 제출물(게시물 URL·스크린샷·인사이트) 상세 열람.
 * `onChanged` 는 모달에서 인사이트를 보정 저장했을 때 호출된다 — 호출부 목록 갱신용.
 * 정산관리·리포트가 같은 모달을 쓰므로 로딩과 모달 소유권을 여기 모은다.
 * 버튼 문구는 화면마다 규칙이 달라 호출부에 남긴다.
 */
export function useSubmissionDetail(onChanged?: () => void): SubmissionDetail {
  const { language } = useLanguage();
  const [draft, setDraft] = useState<DraftReview | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function open(applicationId: string) {
    if (loadingId) return;
    setLoadingId(applicationId);
    try {
      const submission = await fetchSubmission(applicationId);
      setDraft(toDraftReview(submission, new Date(), language));
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : translate(
              "domains.application.drafts.errors.submissionLoadFailed",
              getStoredLanguage(),
            ),
      );
    } finally {
      setLoadingId(null);
    }
  }

  return {
    open: (applicationId) => void open(applicationId),
    loadingId,
    dialog: draft ? (
      <InsightDetailDialog
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={onChanged}
      />
    ) : null,
  };
}
