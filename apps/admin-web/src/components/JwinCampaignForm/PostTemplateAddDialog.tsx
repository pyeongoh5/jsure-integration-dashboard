import { useState } from "react";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import type { AdminPostTemplateCreate } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { JwinMediaUpload } from "./JwinMediaUpload";
import { jstLocalToUtcIso } from "./jwinDateTime";
import styles from "./JwinCampaignTabs.module.css";

const BODY_MAX_LENGTH = 500;

type Props = {
  open: boolean;
  onClose: () => void;
  /** 다이얼로그를 열 때 기본값으로 채울 JST datetime-local 문자열 */
  defaultActiveFrom: string;
  defaultActiveTo: string;
  onAdd: (body: Omit<AdminPostTemplateCreate, "campaignId">) => Promise<string | null>;
};

export function PostTemplateAddDialog({
  open,
  onClose,
  defaultActiveFrom,
  defaultActiveTo,
  onAdd,
}: Props) {
  const t = useT();
  const [label, setLabel] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [activeFrom, setActiveFrom] = useState(defaultActiveFrom);
  const [activeTo, setActiveTo] = useState(defaultActiveTo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setLabel("");
    setBodyText("");
    setMediaUrl(null);
    setActiveFrom(defaultActiveFrom);
    setActiveTo(defaultActiveTo);
    setSaving(false);
    setError(null);
    onClose();
  };

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
    const invalid = validationError();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onAdd({
      label: label.trim(),
      bodyText,
      mediaUrl: mediaUrl ?? undefined,
      activeFrom: jstLocalToUtcIso(activeFrom),
      activeTo: jstLocalToUtcIso(activeTo),
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    handleClose();
  };

  const counterClassName = [styles.counter, bodyText.length > BODY_MAX_LENGTH ? styles.counterOver : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("jwin.postTemplate.add")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleClose} disabled={saving}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? t("jwin.prize.action.registering") : t("jwin.prize.action.register")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.label")}</span>
          <Input
            value={label}
            onChange={setLabel}
            placeholder={t("jwin.postTemplate.placeholder.label")}
          />
          <span className={styles.fieldHint}>{t("jwin.postTemplate.hint.label")}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.postTemplate.field.body")}</span>
          <Textarea
            value={bodyText}
            onChange={setBodyText}
            rows={6}
            placeholder={t("jwin.postTemplate.placeholder.body")}
          />
          <span className={counterClassName}>
            {bodyText.length} / {BODY_MAX_LENGTH}
          </span>
          {bodyText.trim().length > 0 && !bodyText.includes("{{LP_URL}}") && (
            <span className={styles.fieldHint}>{t("jwin.postTemplate.hint.lpUrlMissing")}</span>
          )}
        </div>

        <JwinMediaUpload
          labelKey="jwin.upload.postMedia"
          value={mediaUrl}
          onChange={setMediaUrl}
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
