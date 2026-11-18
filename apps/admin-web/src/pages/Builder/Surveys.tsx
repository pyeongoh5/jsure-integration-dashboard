import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SurveyTable } from "@/components/BuilderSurveys/SurveyTable";
import { useSurveyListData } from "@/components/BuilderSurveys/useSurveyListData";
import { useSurveyMutations } from "@/components/BuilderSurveys/useSurveyMutations";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Button, buttonClassNames } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./Builder.module.css";

export function BuilderSurveys() {
  const t = useT();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { state, surveys, hasMore, loadingMore, loadMore, reload } =
    useSurveyListData();

  const {
    copySurvey,
    copyPending,
    deleteTarget,
    deletePending,
    requestDelete,
    cancelDelete,
    confirmDelete,
    error: mutationError,
  } = useSurveyMutations({
    onMutated: () => {
      reload();
      setSelectedId(null);
    },
  });

  async function handleCopy() {
    if (!selectedId) return;
    await copySurvey(selectedId);
  }

  function renderBody() {
    if (state.kind === "loading") {
      return <div className={styles.empty}>{t("common.loading")}</div>;
    }
    if (state.kind === "error") {
      return (
        <div className={styles.empty}>
          {state.message}{" "}
          <Button variant="secondary" size="sm" onClick={reload}>
            {t("common.retry")}
          </Button>
        </div>
      );
    }
    return (
      <SurveyTable
        surveys={surveys}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onEdit={(id) => navigate(`/builder/surveys/${encodeURIComponent(id)}/edit`)}
        onRequestDelete={requestDelete}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>{t("pages.builderSurveys.title")}</div>
        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopy}
            disabled={!selectedId || copyPending}
          >
            {t("pages.builderSurveys.copyButton")}
          </Button>
          <Link
            to="/builder/surveys/new"
            className={buttonClassNames({ variant: "primary", size: "md" })}
          >
            {t("pages.builderSurveys.createButton")}
          </Link>
        </div>
      </div>

      {/* 삭제 실패는 다이얼로그가 열려 있을 때 나므로 그 subtitle 에 싣는다 —
          여기서는 복사 실패(다이얼로그 없이 조용히 끝나는 흐름)만 보여준다. */}
      {deleteTarget === null && mutationError && (
        <p className={styles.errorMessage}>{mutationError}</p>
      )}

      <div className={styles.card}>{renderBody()}</div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("pages.builderSurveys.deleteDialog.title")}
        subtitle={mutationError ?? deleteTarget?.title}
        confirmLabel={t("pages.builderSurveys.deleteDialog.confirm")}
        tone="danger"
        busy={deletePending}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
