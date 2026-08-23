import { useEffect, useState } from "react";
import { Button, Dialog, Textarea } from "@/components/ui";
import type { AdminPrize } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { summarizeCodeInput } from "./jwinCodeInput";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  /** null 이면 닫힘 */
  prize: AdminPrize | null;
  onClose: () => void;
  onAppendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

/** 기프트코드 재고 보충. 등록한 개수만큼 수량과 잔여가 함께 늘어난다. */
export function PrizeCodeAppendDialog({ prize, onClose, onAppendCodes }: Props) {
  const t = useT();
  const [codesText, setCodesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCodesText("");
    setError(null);
  }, [prize]);

  const summary = summarizeCodeInput(codesText);

  const handleSubmit = async () => {
    if (!prize) return;
    if (summary.count === 0) {
      setError(t("jwin.prize.error.codesRequired"));
      return;
    }
    if (summary.duplicates.length > 0) {
      setError(
        t("jwin.prize.error.duplicateCodes", { codes: summary.duplicates.slice(0, 3).join(", ") }),
      );
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onAppendCodes(prize.id, codesText);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  const title = prize
    ? t("jwin.prize.action.appendTitle", { name: prize.name })
    : t("jwin.prize.action.appendCodes");

  return (
    <Dialog
      open={prize !== null}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving
              ? t("jwin.prize.action.registering")
              : t("jwin.prize.action.appendSubmit", { count: summary.count })}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.prize.field.codesAppend")}</span>
          <Textarea
            value={codesText}
            onChange={setCodesText}
            rows={8}
            placeholder={t("jwin.prize.placeholder.codes")}
          />
          <span className={styles.fieldHint}>
            {t("jwin.prize.hint.appendCount", { count: summary.count })}
          </span>
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
