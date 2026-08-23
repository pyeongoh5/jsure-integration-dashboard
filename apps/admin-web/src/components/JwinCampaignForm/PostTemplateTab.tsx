import { useMemo, useState } from "react";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminCampaignDetail, AdminPostTemplate, AdminPostTemplateCreate } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { formatCoverageGaps, postTemplateCoverage } from "./postTemplateCoverage";
import { utcIsoToJstLocal } from "./jwinDateTime";
import { PostTemplateAddDialog } from "./PostTemplateAddDialog";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminCampaignDetail;
  templates: AdminPostTemplate[];
  loading: boolean;
  loadError: string | null;
  onAdd: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
  onDelete: (templateId: string) => Promise<string | null>;
};

/** UTC ISO → "9/1 00:00" (JST, 언어 중립) */
function shortJst(iso: string): string {
  const [date = "", time = ""] = utcIsoToJstLocal(iso).split("T");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${time}`;
}

export function PostTemplateTab({ detail, templates, loading, loadError, onAdd, onDelete }: Props) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const coverage = useMemo(() => postTemplateCoverage(detail, templates), [detail, templates]);

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    setDeleteError(null);
    const failure = await onDelete(templateId);
    setDeletingId(null);
    if (failure) setDeleteError(failure);
  };

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>{t("jwin.postTemplate.title")}</h2>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          {t("jwin.postTemplate.add")}
        </Button>
      </div>

      {!loading && coverage.gaps.length > 0 && (
        <div className={styles.warning}>
          {t("jwin.postTemplate.coverageWarning", { gaps: formatCoverageGaps(coverage.gaps) })}
        </div>
      )}

      {loadError && <div className={styles.errorText}>{loadError}</div>}
      {deleteError && <div className={styles.errorText}>{deleteError}</div>}
      {loading && <div className={styles.empty}>{t("jwin.common.loading")}</div>}

      {!loading && templates.length === 0 && (
        <div className={styles.empty}>{t("jwin.postTemplate.empty")}</div>
      )}

      {!loading && templates.length > 0 && (
        <ScrollTable minWidth={860}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("jwin.postTemplate.columns.label")}</th>
                <th>{t("jwin.postTemplate.columns.body")}</th>
                <th>{t("jwin.postTemplate.columns.period")}</th>
                <th>{t("jwin.postTemplate.columns.media")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.label}</td>
                  <td>
                    <div className={styles.bodyPreview}>{template.bodyText}</div>
                  </td>
                  <td>
                    {shortJst(template.activeFrom)} ~ {shortJst(template.activeTo)}
                  </td>
                  <td>
                    {template.mediaUrl
                      ? t("jwin.postTemplate.mediaPresent")
                      : t("jwin.common.dash")}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleDelete(template.id)}
                        disabled={template.used || deletingId === template.id}
                        title={
                          template.used ? t("jwin.postTemplate.deleteBlocked") : undefined
                        }
                      >
                        {t("jwin.common.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}

      <PostTemplateAddDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultActiveFrom={utcIsoToJstLocal(detail.startsAt)}
        defaultActiveTo={utcIsoToJstLocal(detail.endsAt)}
        onAdd={onAdd}
      />
    </div>
  );
}
