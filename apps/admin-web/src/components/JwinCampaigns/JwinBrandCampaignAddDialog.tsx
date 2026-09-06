import { useEffect, useState } from "react";
import { Button, Dialog, Input } from "@/components/ui";
import {
  createBrandCampaign,
  fetchBrandAccounts,
  jwinErrorMessage,
  type AdminBrandAccount,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinBrandCampaignAddDialog.module.css";

type Props = {
  open: boolean;
  campaignId: string;
  /** 이미 참여 중인 브랜드는 고를 수 없다 (한 시즌에 중복 참여 금지) */
  participatingBrandIds: string[];
  onClose: () => void;
  onAdded: () => void;
};

/** 등록된 브랜드를 골라 시즌에 참여시킨다. 게시 설정은 이후 참여 편집에서 다듬는다. */
export function JwinBrandCampaignAddDialog({
  open,
  campaignId,
  participatingBrandIds,
  onClose,
  onAdded,
}: Props) {
  const t = useT();
  const [accounts, setAccounts] = useState<AdminBrandAccount[]>([]);
  const [brandAccountId, setBrandAccountId] = useState("");
  const [dailyPostTime, setDailyPostTime] = useState("11:00");
  const [dailyWinCap, setDailyWinCap] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setBrandAccountId("");
    fetchBrandAccounts()
      .then((result) => {
        if (!cancelled) setAccounts(result.accounts);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(jwinErrorMessage(caught, t("jwin.connect.accountsLoadFailed")));
      });
    return () => {
      cancelled = true;
    };
  }, [open, t]);

  const selectable = accounts.filter(
    (account) => !participatingBrandIds.includes(account.id),
  );

  const handleSubmit = async () => {
    if (!brandAccountId) {
      setError(t("jwin.campaign.brands.selectBrand"));
      return;
    }
    const cap = dailyWinCap.trim();
    setSaving(true);
    setError(null);
    try {
      await createBrandCampaign({
        campaignId,
        brandAccountId,
        dailyPostTime,
        dailyWinCap: cap === "" ? null : Number(cap),
      });
      onAdded();
    } catch (caught: unknown) {
      setError(jwinErrorMessage(caught, t("jwin.campaign.brands.addFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.campaign.brands.add")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? t("jwin.common.saving") : t("jwin.prize.action.register")}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>{t("jwin.connect.brandAccount")}</span>
          <select
            className={styles.select}
            value={brandAccountId}
            onChange={(event) => setBrandAccountId(event.target.value)}
          >
            <option value="">{t("jwin.campaign.brands.selectBrand")}</option>
            {selectable.map((account) => (
              <option key={account.id} value={account.id}>
                {account.xUsername ? `${account.label} (@${account.xUsername})` : account.label}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.row2}>
          <label className={styles.field}>
            <span className={styles.label}>{t("jwin.basic.dailyPostTime")}</span>
            <Input type="time" value={dailyPostTime} onChange={setDailyPostTime} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>{t("jwin.basic.dailyWinCap")}</span>
            <Input
              type="number"
              min={1}
              value={dailyWinCap}
              onChange={setDailyWinCap}
              placeholder={t("jwin.basic.dailyWinCapPlaceholder")}
            />
          </label>
        </div>

        {error && <span className={styles.error}>{error}</span>}
      </div>
    </Dialog>
  );
}
