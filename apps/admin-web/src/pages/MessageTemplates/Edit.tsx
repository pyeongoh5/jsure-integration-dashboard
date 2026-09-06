import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getTemplate,
  previewTemplate,
  updateTemplate,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_LABELS,
  VariablesPanel,
  type CampaignCategory,
  type LineMessageTemplateDetailResponse,
  type LineTriggerKey,
} from "@/domains/messageTemplate";
import { Button, Dialog, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./MessageTemplates.module.css";

const VAR_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

function findUnknownVariables(body: string, allowed: string[]): string[] {
  const set = new Set(allowed);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const key = match[1];
    if (key === undefined) continue;
    if (!set.has(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function MessageTemplateEdit(): JSX.Element {
  const t = useT();
  const params = useParams<{
    category: CampaignCategory;
    triggerKey: LineTriggerKey;
  }>();
  const navigate = useNavigate();
  const category = params.category!;
  const triggerKey = params.triggerKey!;
  const listPath = `/message-templates?category=${encodeURIComponent(category)}`;
  const descriptionKey = TRIGGER_DESCRIPTIONS[triggerKey];

  const [detail, setDetail] = useState<LineMessageTemplateDetailResponse | null>(null);
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getTemplate(category, triggerKey).then((res) => {
      setDetail(res);
      setBody(res.template.body);
    });
  }, [category, triggerKey]);

  if (!detail) {
    return (
      <div className={styles.edit}>
        <div className={styles.state}>{t("common.loading")}</div>
      </div>
    );
  }

  const unknownVars = findUnknownVariables(
    body,
    detail.variables.map((v) => v.key),
  );
  const buildValidationError = (): string | null => {
    if (body.length > 5000) return t("pages.messageTemplates.bodyOverLimit");
    if (unknownVars.length > 0) {
      return t("pages.messageTemplates.unknownVariables", {
        variables: unknownVars.map((variableKey) => `{{${variableKey}}}`).join(", "),
      });
    }
    return null;
  };
  const validationError = buildValidationError();

  const insertVariable = (key: string): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${body.substring(0, start)}{{${key}}}${body.substring(end)}`;
    setBody(next);
    setTimeout(() => {
      const pos = start + `{{${key}}}`.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const doSave = async (): Promise<void> => {
    if (validationError) return;
    setSaving(true);
    setError(null);
    try {
      await updateTemplate(category, triggerKey, { body });
      navigate(listPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.messageTemplates.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const doPreview = async (): Promise<void> => {
    if (validationError) return;
    try {
      const res = await previewTemplate(category, triggerKey, body);
      setPreview(res.renderedBody);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.messageTemplates.previewFailed"));
    }
  };

  return (
    <div className={styles.edit}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate(listPath)}
      >
        {t("pages.messageTemplates.backToList")}
      </button>

      <div className={styles.editHeader}>
        <div className={styles.editTitle}>{t(TRIGGER_LABELS[triggerKey])}</div>
        {descriptionKey && (
          <div className={styles.triggerDescription}>{t(descriptionKey)}</div>
        )}
      </div>

      <div className={styles.editBody}>
        <div className={styles.editLeft}>
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={setBody}
            rows={20}
            placeholder={t("pages.messageTemplates.bodyPlaceholder")}
          />
          <div className={styles.counter}>
            {t("pages.messageTemplates.charCount", { count: body.length })}
          </div>
          {validationError && <div className={styles.error}>{validationError}</div>}
          {error && <div className={styles.error}>{error}</div>}
        </div>

        <aside className={styles.editRight}>
          <VariablesPanel variables={detail.variables} onInsert={insertVariable} />
        </aside>
      </div>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => navigate(listPath)}>
          {t("common.cancel")}
        </Button>
        <Button variant="secondary" onClick={doPreview} disabled={!!validationError}>
          {t("pages.messageTemplates.preview")}
        </Button>
        <Button variant="primary" onClick={doSave} disabled={!!validationError || saving}>
          {saving ? t("pages.messageTemplates.saving") : t("pages.messageTemplates.save")}
        </Button>
      </div>

      <Dialog
        open={preview !== null}
        onClose={() => setPreview(null)}
        title={t("pages.messageTemplates.preview")}
        className={styles.previewDialog}
        footer={
          <Button variant="secondary" onClick={() => setPreview(null)}>
            {t("common.close")}
          </Button>
        }
      >
        <div className={styles.previewBox}>{preview}</div>
      </Dialog>
    </div>
  );
}
