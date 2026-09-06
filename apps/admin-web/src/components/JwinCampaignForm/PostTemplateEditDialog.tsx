import { useEffect, useState } from "react";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import type { AdminPostTemplate, AdminPostTemplatePatch } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { JwinMediaListUpload } from "./JwinMediaListUpload";
import { jstLocalToUtcIso, utcIsoToJstLocal } from "./jwinDateTime";
import styles from "./JwinCampaignTabs.module.css";

const BODY_MAX_LENGTH = 500;

type Props = {
  /** null 이면 닫힘 */
  template: AdminPostTemplate | null;
  onClose: () => void;
  onEdit: (templateId: string, body: AdminPostTemplatePatch) => Promise<string | null>;
};

/**
 * 포스트 정정. 이미 게시에 사용된 포스트도 고칠 수 있다 —
 * 이미 나간 트윗은 바뀌지 않고 앞으로의 게시부터 반영된다.
 */
export function PostTemplateEditDialog({ template, onClose, onEdit }: Props) {
  const t = useT();
  const [label, setLabel] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [activeFrom, setActiveFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!template) return;
    setLabel(template.label);
    setBodyText(template.bodyText);
    setMediaUrls(template.mediaUrls);
    setActiveFrom(utcIsoToJstLocal(template.activeFrom));
    setActiveTo(utcIsoToJstLocal(template.activeTo));
    setSaving(false);
    setError(null);
  }, [template]);

  const validationError = (): string | null => {
    if (!label.trim()) return t("jwin.postTemplate.error.labelRequired");
    if (!bodyText.trim()) return t("jwin.postTemplate.error.bodyRequired");
    if (bodyText.length > BODY_MAX_LENGTH) {
      return t("jwin.postTemplate.error.bodyTooLong", { max: BODY_MAX_LENGTH });
    }
    if (!activeFrom || !activeTo) return t("jwin.postTemplate.error.periodRequired");
    if (activeTo <= activeFrom) return t("jwin.postTemplate.error.periodOrder");
    return null;
  };

  const handleSubmit = async () => {
    if (!template) return;
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onEdit(template.id, {
      label: label.trim(),
      bodyText,
      mediaUrls,
      activeFrom: jstLocalToUtcIso(activeFrom),
      activeTo: jstLocalToUtcIso(activeTo),
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  const counterClassName = [
    styles.counter,
    bodyText.length > BODY_MAX_LENGTH ? styles.counterOver : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog
      open={template !== null}
      onClose={onClose}
      title={t("jwin.postTemplate.editTitle")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? t("jwin.common.saving") : t("jwin.common.save")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        {template?.used && (
          <div className={styles.warning}>{t("jwin.postTemplate.hint.editUsed")}</div>
        )}

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.label")}</span>
          <Input value={label} onChange={setLabel} />
          <span className={styles.fieldHint}>{t("jwin.postTemplate.hint.label")}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.body")}</span>
          <Textarea value={bodyText} onChange={setBodyText} rows={6} />
          <span className={counterClassName}>
            {bodyText.length} / {BODY_MAX_LENGTH}
          </span>
          {bodyText.trim().length > 0 && !bodyText.includes("{{LP_URL}}") && (
            <span className={styles.fieldHint}>{t("jwin.postTemplate.hint.lpUrlMissing")}</span>
          )}
        </div>

        <JwinMediaListUpload
          labelKey="jwin.upload.postMedia"
          value={mediaUrls}
          onChange={setMediaUrls}
          disabled={saving}
        />

        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.activeFrom")}</span>
            <Input type="datetime-local" value={activeFrom} onChange={setActiveFrom} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.activeTo")}</span>
            <Input type="datetime-local" value={activeTo} onChange={setActiveTo} />
          </div>
        </div>
        <span className={styles.fieldHint}>{t("jwin.postTemplate.hint.materializeTime")}</span>

        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
