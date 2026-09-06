import { useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import type { AdminPrize, AdminPrizeCreate, AdminPrizePatch } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import {
  formatProbabilityPercent,
  isProbabilityOverflow,
  probabilitySum,
} from "./prizeProbability";
import { PrizeAddDialog } from "./PrizeAddDialog";
import { PrizeEditDialog } from "./PrizeEditDialog";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  prizes: AdminPrize[];
  loading: boolean;
  loadError: string | null;
  onAdd: (body: Omit<AdminPrizeCreate, "campaignId">) => Promise<string | null>;
  onEdit: (prizeId: string, body: AdminPrizePatch) => Promise<string | null>;
  onAppendCodes: (prizeId: string, codesText: string) => Promise<string | null>;
};

const TYPE_LABEL_KEY: Record<AdminPrize["type"], AdminTranslationKey> = {
  PHYSICAL: "jwin.prize.type.physical",
  CODE: "jwin.prize.type.code",
};

export function PrizeTab({ prizes, loading, loadError, onAdd, onEdit, onAppendCodes }: Props) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPrize | null>(null);

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>{t("jwin.prize.title")}</h2>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          {t("jwin.prize.add")}
        </Button>
      </div>

      {isProbabilityOverflow(prizes) && (
        <div className={styles.warning}>
          {t("jwin.prize.probabilityOverflow", {
            sum: formatProbabilityPercent(probabilitySum(prizes)),
          })}
        </div>
      )}

      {loadError && <div className={styles.errorText}>{loadError}</div>}
      {loading && <div className={styles.empty}>{t("jwin.common.loading")}</div>}

      {!loading && prizes.length === 0 && (
        <div className={styles.empty}>{t("jwin.prize.empty")}</div>
      )}

      {!loading && prizes.length > 0 && (
        <ScrollTable minWidth={760}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("jwin.prize.columns.name")}</th>
                <th>{t("jwin.prize.columns.type")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.tier")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.quantity")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.probability")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.codeStock")}</th>
                <th className={styles.actionsHead}>{t("jwin.prize.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <tr key={prize.id}>
                  <td>{prize.name}</td>
                  <td>{t(TYPE_LABEL_KEY[prize.type])}</td>
                  <td className={styles.num}>{prize.tier}</td>
                  <td className={styles.num}>
                    {prize.remainingQty} / {prize.totalQty}
                  </td>
                  <td className={styles.num}>{formatProbabilityPercent(prize.winProbability)}</td>
                  <td className={styles.num}>
                    {prize.type === "CODE" ? prize.availableCodeCount : t("jwin.common.dash")}
                  </td>
                  <td className={styles.actionsCell}>
                    <div className={styles.rowActions}>
                      <Button variant="secondary" size="sm" onClick={() => setEditing(prize)}>
                        {t("jwin.prize.action.edit")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}

      <PrizeAddDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={onAdd} />
      <PrizeEditDialog
        prize={editing}
        onClose={() => setEditing(null)}
        onEdit={onEdit}
        onAppendCodes={onAppendCodes}
      />
    </div>
  );
}
