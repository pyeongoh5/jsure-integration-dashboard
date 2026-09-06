import { useEffect, useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { Button, Dialog, Input, Textarea } from "@/components/ui";
import {
  fetchPrizeCodes,
  jwinErrorMessage,
  type AdminPrize,
  type AdminPrizeCode,
  type AdminPrizePatch,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { summarizeCodeInput } from "./jwinCodeInput";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  /** null 이면 닫힘 */
  prize: AdminPrize | null;
  onClose: () => void;
  onEdit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
  onAppendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

const CODE_STATUS_LABEL: Record<AdminPrizeCode["status"], AdminTranslationKey> = {
  AVAILABLE: "jwin.prize.codeStatus.available",
  ASSIGNED: "jwin.prize.codeStatus.assigned",
  SENT: "jwin.prize.codeStatus.sent",
  REVOKED: "jwin.prize.codeStatus.revoked",
};

/**
 * 경품 정정 (이름·티어·수량·확률). CODE 경품이면 등록된 코드 원문을 함께 보여주고
 * 같은 모달에서 코드를 추가한다 — 정정과 코드 추가를 따로 열지 않는다.
 * CODE 경품의 수량은 서버가 PATCH 를 거부한다(유령 재고 방지) — 입력을 잠그고 안내한다.
 */
export function PrizeEditDialog({ prize, onClose, onEdit, onAppendCodes }: Props) {
  const t = useT();
  const [name, setName] = useState("");
  const [tier, setTier] = useState("1");
  const [totalQty, setTotalQty] = useState("");
  const [winProbability, setWinProbability] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codesText, setCodesText] = useState("");
  const [codes, setCodes] = useState<AdminPrizeCode[]>([]);
  const [codesError, setCodesError] = useState<string | null>(null);
  const [codesLoading, setCodesLoading] = useState(false);
  const isCodePrize = prize?.type === "CODE";

  useEffect(() => {
    if (!prize) return;
    setName(prize.name);
    setTier(String(prize.tier));
    setTotalQty(String(prize.totalQty));
    setWinProbability(String(prize.winProbability));
    setError(null);
    setCodesText("");
  }, [prize]);

  // 코드 원문은 열 때마다 서버에서 받아온다 — 목록 응답에는 담기지 않는다.
  useEffect(() => {
    if (!prize || prize.type !== "CODE") {
      setCodes([]);
      return;
    }
    let cancelled = false;
    setCodesLoading(true);
    setCodesError(null);
    fetchPrizeCodes(prize.id)
      .then((result) => {
        if (!cancelled) setCodes(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setCodesError(jwinErrorMessage(reason, t("jwin.prize.codesLoadFailed")));
      })
      .finally(() => {
        if (!cancelled) setCodesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prize, t]);

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

    const codeSummary = summarizeCodeInput(codesText);
    if (isCodePrize && codeSummary.duplicates.length > 0) {
      setError(
        t("jwin.prize.error.duplicateCodes", {
          codes: codeSummary.duplicates.slice(0, 3).join(", "),
        }),
      );
      return;
    }

    setSaving(true);
    setError(null);
    const failure = await onEdit(prize.id, body);
    if (failure) {
      setSaving(false);
      setError(failure);
      return;
    }
    // 정정을 먼저 반영하고, 입력된 코드가 있을 때만 이어서 추가한다.
    if (isCodePrize && codeSummary.count > 0) {
      const appendFailure = await onAppendCodes(prize.id, codesText);
      if (appendFailure) {
        setSaving(false);
        setError(appendFailure);
        return;
      }
    }
    setSaving(false);
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
        {isCodePrize && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t("jwin.prize.field.existingCodes")}</span>
              {codesLoading ? (
                <span className={styles.fieldHint}>{t("jwin.common.loading")}</span>
              ) : codesError ? (
                <span className={styles.errorText}>{codesError}</span>
              ) : codes.length === 0 ? (
                <span className={styles.fieldHint}>{t("jwin.prize.codesEmpty")}</span>
              ) : (
                <ul className={styles.codeList}>
                  {codes.map((code) => (
                    <li key={code.id} className={styles.codeItem}>
                      <span className={styles.codeValue}>{code.code}</span>
                      <span className={styles.codeStatus}>
                        {t(CODE_STATUS_LABEL[code.status])}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <span className={styles.fieldHint}>{t("jwin.prize.hint.codesPlaintext")}</span>
            </div>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>{t("jwin.prize.field.codesAppend")}</span>
              <Textarea
                value={codesText}
                onChange={setCodesText}
                rows={5}
                placeholder={t("jwin.prize.placeholder.codes")}
              />
              <span className={styles.fieldHint}>
                {t("jwin.prize.hint.appendCount", {
                  count: summarizeCodeInput(codesText).count,
                })}
              </span>
            </div>
          </>
        )}

        {error && <span className={styles.errorText}>{error}</span>}
      </div>
    </Dialog>
  );
}
