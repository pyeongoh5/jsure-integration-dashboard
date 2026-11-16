import { useCallback, useState } from "react";
import type { BuilderSurveyListItem } from "@jsure/shared";
import { createSurvey, deleteSurvey, fetchSurvey } from "@/domains/builderSurvey";
import { useT } from "@/lib/i18n";
import { copyTitle } from "./copyTitle";

type Options = {
  onMutated?: () => void | Promise<void>;
};

/**
 * 복사·삭제 mutation 과 삭제 확인 다이얼로그 상태를 함께 들고 있다. 전용 복사
 * 엔드포인트가 없어 fetchSurvey → copyTitle → createSurvey 세 호출을 여기서 묶는다.
 */
export function useSurveyMutations({ onMutated }: Options = {}) {
  const t = useT();
  const [copyPending, setCopyPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BuilderSurveyListItem | null>(
    null,
  );
  const [deletePending, setDeletePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copySurvey = useCallback(
    async (id: string): Promise<boolean> => {
      setCopyPending(true);
      setError(null);
      try {
        const original = await fetchSurvey(id);
        await createSurvey({
          title: copyTitle(original.title, t("pages.builderSurveys.copySuffix")),
          description: original.description ?? undefined,
          questions: original.questions,
        });
        await onMutated?.();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("pages.builderSurveys.copyFailed"),
        );
        return false;
      } finally {
        setCopyPending(false);
      }
    },
    [onMutated, t],
  );

  const requestDelete = useCallback((survey: BuilderSurveyListItem) => {
    setDeleteTarget(survey);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    setError(null);
    try {
      await deleteSurvey(deleteTarget.id);
      await onMutated?.();
      setDeleteTarget(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("pages.builderSurveys.deleteFailed"),
      );
    } finally {
      setDeletePending(false);
    }
  }, [deleteTarget, onMutated, t]);

  return {
    copySurvey,
    copyPending,
    deleteTarget,
    deletePending,
    requestDelete,
    cancelDelete,
    confirmDelete,
    error,
  };
}
