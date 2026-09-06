import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import { JwinMediaUpload } from "@/components/JwinCampaignForm";
import type { AdminBrandAccountPatch } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import type { JwinBrandAccountRow } from "./jwinBrandAccountTransform";
import styles from "./AddBrandAccountDialog.module.css";

type Props = {
  /** null 이면 닫힘 */
  account: JwinBrandAccountRow | null;
  onClose: () => void;
  /** 성공하면 null, 실패하면 메시지 */
  onEdit: (brandAccountId: string, body: AdminBrandAccountPatch) => Promise<string | null>;
};

/** 브랜드 표시명·slug·로고 수정. 연동 토큰은 여기서 다루지 않는다. */
export function EditBrandAccountDialog({ account, onClose, onEdit }: Props) {
  const t = useT();
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account) return;
    setLabel(account.label);
    setSlug(account.slug);
    setLogoUrl(account.logoUrl);
    setError(null);
  }, [account]);

  const handleSubmit = async () => {
    if (!account) return;
    if (!label.trim()) return;
    if (!/^[a-z0-9-]+$/.test(slug.trim())) {
      setError(t("jwin.basic.error.slugFormat"));
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onEdit(account.id, {
      label: label.trim(),
      slug: slug.trim(),
      logoUrl,
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={account !== null}
      onClose={onClose}
      title={t("jwin.account.editTitle")}
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
      <div className={styles.body}>
        <label className={styles.label} htmlFor="brand-account-edit-label">
          {t("jwin.account.label")}
        </label>
        <Input id="brand-account-edit-label" value={label} onChange={setLabel} disabled={saving} />

        <label className={styles.label} htmlFor="brand-account-edit-slug">
          {t("jwin.account.slug")}
        </label>
        <Input id="brand-account-edit-slug" value={slug} onChange={setSlug} disabled={saving} />
        <p className={styles.description}>{t("jwin.account.slugHint")}</p>

        <JwinMediaUpload
          labelKey="jwin.account.logo"
          value={logoUrl}
          onChange={setLogoUrl}
          disabled={saving}
        />

        {error && <div className={styles.error}>{error}</div>}
      </div>
    </Dialog>
  );
}
