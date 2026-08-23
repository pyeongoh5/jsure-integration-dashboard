import { useState } from "react";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import type { AdminPrizeCreate } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { summarizeCodeInput } from "./jwinCodeInput";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 성공하면 null, 실패하면 메시지 */
  onAdd: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
};

type PrizeType = "PHYSICAL" | "CODE";

/** 경품 추가. 입력 상태는 여기서만 보관한다(CODE_RULES §7 — 부모로 끌어올리지 않음). */
export function PrizeAddDialog({ open, onClose, onAdd }: Props) {
  const t = useT();
  const [type, setType] = useState<PrizeType>("PHYSICAL");
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [winProbability, setWinProbability] = useState("");
  const [codesText, setCodesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantity = Number(totalQty);
  const probability = Number(winProbability);
  const codeSummary = summarizeCodeInput(codesText);

  const handleClose = () => {
    setType("PHYSICAL");
    setName("");
    setTier("1");
    setTotalQty("");
    setWinProbability("");
    setCodesText("");
    setSaving(false);
    setError(null);
    onClose();
  };

  const validationError = (): string | null => {
    if (!name.trim()) return t("jwin.prize.error.nameRequired");
    if (!Number.isInteger(quantity) || quantity <= 0) return t("jwin.prize.error.quantityInvalid");
    if (!Number.isInteger(Number(tier)) || Number(tier) < 1) return t("jwin.prize.error.tierInvalid");
    if (!(probability > 0 && probability < 1)) return t("jwin.prize.error.probabilityInvalid");
    if (type !== "CODE") return null;
    if (codeSummary.duplicates.length > 0) {
      return t("jwin.prize.error.duplicateCodes", {
        codes: codeSummary.duplicates.slice(0, 3).join(", "),
      });
    }
    if (codeSummary.count !== quantity) {
      return t("jwin.prize.error.countMismatch", { count: codeSummary.count, quantity });
    }
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
      type,
      name: name.trim(),
      tier: Number(tier),
      totalQty: quantity,
      winProbability: probability,
      codesText: type === "CODE" ? codesText : undefined,
    });
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={t("jwin.prize.add")}
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
          <span className={styles.fieldLabel}>{t("jwin.prize.field.type")}</span>
          <div className={styles.typeChoice}>
            <label>
              <input
                type="radio"
                name="prize-type"
                checked={type === "PHYSICAL"}
                onChange={() => setType("PHYSICAL")}
              />{" "}
              {t("jwin.prize.type.physicalOption")}
            </label>
            <label>
              <input
                type="radio"
                name="prize-type"
                checked={type === "CODE"}
                onChange={() => setType("CODE")}
              />{" "}
              {t("jwin.prize.type.codeOption")}
            </label>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.prize.field.name")}</span>
          <Input value={name} onChange={setName} placeholder={t("jwin.prize.placeholder.name")} />
        </div>

        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.prize.field.tier")}</span>
            <Input type="number" min={1} value={tier} onChange={setTier} />
            <span className={styles.fieldHint}>{t("jwin.prize.hint.tier")}</span>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.prize.field.quantity")}</span>
            <Input type="number" min={1} value={totalQty} onChange={setTotalQty} placeholder="10" />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.prize.field.probability")}</span>
          <Input
            type="number"
            step="0.001"
            min={0}
            max={1}
            value={winProbability}
            onChange={setWinProbability}
            placeholder="0.05"
          />
          <span className={styles.fieldHint}>{t("jwin.prize.hint.probability")}</span>
        </div>

        {type === "CODE" && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.prize.field.codes")}</span>
            <Textarea
              value={codesText}
              onChange={setCodesText}
              rows={8}
              placeholder={t("jwin.prize.placeholder.codes")}
            />
            <span className={styles.fieldHint}>
              {t("jwin.prize.hint.codeCount", {
                count: codeSummary.count,
                quantity: Number.isFinite(quantity) ? quantity : 0,
              })}
            </span>
            {codeSummary.duplicates.length > 0 && (
              <span className={styles.errorText}>
                {t("jwin.prize.error.duplicateCount", {
                  count: codeSummary.duplicates.length,
                  codes: codeSummary.duplicates.slice(0, 3).join(", "),
                })}
              </span>
            )}
          </div>
        )}

        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
