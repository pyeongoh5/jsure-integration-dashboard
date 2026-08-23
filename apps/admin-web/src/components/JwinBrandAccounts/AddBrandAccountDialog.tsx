import { useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import type { AdminBrandAccount } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./AddBrandAccountDialog.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (label: string) => Promise<AdminBrandAccount | null>;
};

/** 계정 추가 다이얼로그. 입력 상태는 여기서만 보관한다(§7 — 부모로 끌어올리지 않음). */
export function AddBrandAccountDialog({ open, onClose, onCreate }: Props) {
  const t = useT();
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminBrandAccount | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const handleClose = () => {
    setLabel("");
    setCreating(false);
    setError(null);
    setCreated(null);
    setCopyState("idle");
    onClose();
  };

  const handleCreate = async () => {
    if (!label.trim()) return;
    setCreating(true);
    setError(null);
    const account = await onCreate(label.trim());
    setCreating(false);
    if (account) {
      setCreated(account);
    } else {
      setError(t("jwin.account.createFailed"));
    }
  };

  const handleCopy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.connectUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={created ? t("jwin.account.linkTitle") : t("jwin.account.add")}
      footer={
        created ? (
          <Button variant="primary" size="md" onClick={handleClose}>
            {t("jwin.common.close")}
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="md" onClick={handleClose}>
              {t("jwin.common.cancel")}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCreate}
              disabled={!label.trim() || creating}
            >
              {creating ? t("jwin.account.creating") : t("jwin.account.create")}
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className={styles.body}>
          <p className={styles.description}>{t("jwin.account.handoffNote")}</p>
          <div className={styles.linkRow}>
            <Input value={created.connectUrl} readOnly />
            <Button variant="secondary" size="md" onClick={handleCopy}>
              {copyState === "copied" ? t("jwin.common.copied") : t("jwin.common.copy")}
            </Button>
          </div>
          {copyState === "failed" && (
            <div className={styles.error}>{t("jwin.account.copyFailedAbove")}</div>
          )}
        </div>
      ) : (
        <div className={styles.body}>
          <label className={styles.label} htmlFor="brand-account-label">
            {t("jwin.account.label")}
          </label>
          <Input
            id="brand-account-label"
            value={label}
            onChange={setLabel}
            placeholder={t("jwin.account.labelPlaceholder")}
            disabled={creating}
            autoFocus
          />
          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </Dialog>
  );
}
