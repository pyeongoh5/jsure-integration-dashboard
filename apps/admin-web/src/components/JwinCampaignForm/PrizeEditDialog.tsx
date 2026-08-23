import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import type { AdminPrize, AdminPrizePatch } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  /** null 이면 닫힘 */
  prize: AdminPrize | null;
  onClose: () => void;
  onEdit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
};

/**
 * 경품 정정 (이름·티어·수량·확률).
 * CODE 경품의 수량은 서버가 PATCH 를 거부한다(유령 재고 방지) — 입력을 잠그고 안내한다.
 */
export function PrizeEditDialog({ prize, onClose, onEdit }: Props) {
  const t = useT();
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [winProbability, setWinProbability] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!prize) return;
    setName(prize.name);
    setTier(String(prize.tier));
    setTotalQty(String(prize.totalQty));
    setWinProbability(String(prize.winProbability));
    setError(null);
  }, [prize]);

  const handleSubmit = async () => {
    if (!prize) return;
    const quantity = Number(totalQty);
    const probability = Number(winProbability);
    if (!name.trim()) {
      setError(t("jwin.prize.error.nameRequired"));
      return;
    }
    if (!(probability > 0 && probability < 1)) {
      setError(t("jwin.prize.error.probabilityInvalid"));
      return;
    }
    const body: AdminPrizePatch = {
      name: name.trim(),
      tier: Number(tier),
      winProbability: probability,
    };
    // CODE 경품은 수량을 보내지 않는다 — 서버가 거부한다
    if (prize.type !== "CODE") body.totalQty = quantity;

    setSaving(true);
    setError(null);
    const failure = await onEdit(prize.id, body);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onClose();
  };

  return (
    <Dialog
      open={prize !== null}
      onClose={onClose}
      title={t("jwin.prize.editTitle")}
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
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t("jwin.prize.field.name")}</span>
          <Input value={name} onChange={setName} />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.prize.field.tier")}</span>
            <Input type="number" min={1} value={tier} onChange={setTier} />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>{t("jwin.prize.field.quantity")}</span>
            <Input
              type="number"
              min={1}
              value={totalQty}
              onChange={setTotalQty}
              disabled={prize?.type === "CODE"}
            />
            {prize?.type === "CODE" && (
              <span className={styles.fieldHint}>{t("jwin.prize.hint.codeQtyLocked")}</span>
            )}
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
          />
        </div>
        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
