import { useState } from "react";
import { ResetAdminUserPasswordRequestSchema } from "@jsure/shared";
import { Button, Dialog, Input } from "@/components/ui";
import { extractApiErrorMessage } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { resetAdminUserPassword } from "../api";
import styles from "./PasswordDialog.module.css";

type Props = {
  memberId: string;
  memberLabel: string;
  onClose: () => void;
};

/**
 * OWNER 가 비밀번호를 잊은 멤버에게 임시 비밀번호를 발급한다.
 * 메일 발송 경로가 없어 OWNER 가 안전한 채널로 직접 전달해야 한다.
 */
export function ResetMemberPasswordDialog({
  memberId,
  memberLabel,
  onClose,
}: Props) {
  const t = useT();
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const parsed = ResetAdminUserPasswordRequestSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setError(t("pages.team.password.invalidInput"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await resetAdminUserPassword(memberId, newPassword);
      window.alert(t("pages.team.password.resetDone", { password: newPassword }));
      onClose();
    } catch (caught: unknown) {
      setError(extractApiErrorMessage(caught, t("pages.team.password.resetFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("pages.team.password.resetTitle", { member: memberLabel })}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving
              ? t("pages.team.password.saving")
              : t("pages.team.password.resetSubmit")}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>{t("pages.team.password.temporary")}</span>
          <Input
            type="text"
            autoComplete="off"
            value={newPassword}
            onChange={setNewPassword}
          />
        </label>
        <span className={styles.hint}>{t("pages.team.password.resetHint")}</span>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    </Dialog>
  );
}
