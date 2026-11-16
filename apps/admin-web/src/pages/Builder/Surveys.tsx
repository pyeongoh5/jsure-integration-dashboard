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

      <div className={styles.card}>
        {state.kind === "loading" ? (
          <div className={styles.empty}>{t("common.loading")}</div>
        ) : state.kind === "error" ? (
          <div className={styles.empty}>
            {state.message}{" "}
            <Button variant="secondary" size="sm" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <SurveyTable
            surveys={surveys}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onEdit={(id) =>
              navigate(`/builder/surveys/${encodeURIComponent(id)}/edit`)
            }
            onRequestDelete={requestDelete}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("pages.builderSurveys.deleteDialog.title")}
        subtitle={deleteTarget?.title}
        confirmLabel={t("pages.builderSurveys.deleteDialog.confirm")}
        tone="danger"
        busy={deletePending}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
