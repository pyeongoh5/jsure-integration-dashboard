import { Button, Input, Textarea } from "@/components/ui";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { DM_PREVIEW_SAMPLE, renderDmPreview } from "./dmTemplatePreview";
import { JwinMediaUpload } from "./JwinMediaUpload";
import { DM_TEMPLATE_MAX_LENGTH, useJwinResultForm } from "./useJwinResultForm";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  detail: AdminBrandCampaignDetail;
  /** CODE 경품이 하나라도 있으면 DM 문구에 {{CODE}} 를 강제한다 */
  hasCodePrize: boolean;
  onSaved: (updated: AdminBrandCampaignDetail) => void;
};

export function ResultTab({ detail, hasCodePrize, onSaved }: Props) {
  const t = useT();
  const form = useJwinResultForm(detail, hasCodePrize, onSaved);

  const preview = renderDmPreview(form.values.dmTemplate, {
    ...DM_PREVIEW_SAMPLE,
    brandName: detail.brandAccount.label,
  });

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>{t("jwin.result.title")}</h2>
      </div>

      <div className={styles.resultForm}>
        <div className={styles.mediaRow}>
          <JwinMediaUpload
            labelKey="jwin.upload.winMedia"
            value={form.values.winMediaUrl}
            onChange={(url) => form.setField("winMediaUrl", url)}
            disabled={form.saving}
          />
          <JwinMediaUpload
            labelKey="jwin.upload.loseMedia"
            value={form.values.loseMediaUrl}
            onChange={(url) => form.setField("loseMediaUrl", url)}
            disabled={form.saving}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.result.prUrl")}</span>
          <Input
            value={form.values.prUrl}
            onChange={(value) => form.setField("prUrl", value)}
            placeholder="https://example.com"
          />
          <span className={styles.fieldHint}>{t("jwin.result.prUrlHint")}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.result.dmTemplate")}</span>
          <Textarea
            value={form.values.dmTemplate}
            onChange={(value) => form.setField("dmTemplate", value)}
            rows={8}
            placeholder={t("jwin.result.dmTemplatePlaceholder")}
          />
          <span className={styles.counter}>
            {form.values.dmTemplate.length} / {DM_TEMPLATE_MAX_LENGTH}
          </span>
          <div className={styles.placeholderList}>
            <span>{t("jwin.result.placeholderCode")}</span>
            <span>{t("jwin.result.placeholderPrizeName")}</span>
            <span>{t("jwin.result.placeholderUsername")}</span>
            <span>{t("jwin.result.placeholderBrandName")}</span>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.result.preview")}</span>
          <div className={styles.dmPreview}>{preview}</div>
          <span className={styles.fieldHint}>{t("jwin.result.previewHint")}</span>
        </div>

        {form.blockedReason && <div className={styles.warning}>{form.blockedReason}</div>}
        {form.error && <div className={styles.errorText}>{form.error}</div>}

        <div className={styles.saveRow}>
          <Button
            variant="primary"
            size="md"
            onClick={() => void form.save()}
            disabled={form.saving || form.blockedReason !== null}
          >
            {form.saving ? t("jwin.common.saving") : t("jwin.common.save")}
          </Button>
          {form.saved && <span className={styles.savedText}>{t("jwin.common.saved")}</span>}
        </div>
      </div>
    </div>
  );
}
