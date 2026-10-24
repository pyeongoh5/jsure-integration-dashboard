import { useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { ScrollTable } from "@/components/composites";
import { Button, Input } from "@/components/ui";
import { MAX_WIN_PROBABILITY } from "@/domains/jwin";
import type { AdminPrize, AdminPrizeCreate, AdminPrizePatch } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { formatProbabilityPercent, percentToProbability, prizeShare } from "./winProbability";
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
  /** 기준 당첨확률(% 입력) — 추첨 설정이라 경품과 같은 탭에 둔다 */
  winProbabilityPercent: string;
  onWinProbabilityChange: (value: string) => void;
  /** 확률 저장 — 저장 버튼을 입력 옆에 두어 미저장 상태를 방지한다 */
  onWinProbabilitySave: () => void;
  winProbabilitySaving: boolean;
  winProbabilitySaved: boolean;
  winProbabilityError: string | null;
};

const TYPE_LABEL_KEY: Record<AdminPrize["type"], AdminTranslationKey> = {
  PHYSICAL: "jwin.prize.type.physical",
  CODE: "jwin.prize.type.code",
};

const CODE_STATUS_LABEL_KEY: Record<
  keyof AdminPrize["codeStatusCounts"],
  AdminTranslationKey
> = {
  available: "jwin.prize.codeStatus.available",
  assigned: "jwin.prize.codeStatus.assigned",
  sent: "jwin.prize.codeStatus.sent",
  revoked: "jwin.prize.codeStatus.revoked",
};

/** 코드 현황 요약 — 미사용은 항상, 나머지 상태는 1개 이상일 때만 표기. */
function codeStatusSummary(
  counts: AdminPrize["codeStatusCounts"],
  t: (key: AdminTranslationKey) => string,
): string {
  const statuses: (keyof AdminPrize["codeStatusCounts"])[] = [
    "available",
    "assigned",
    "sent",
    "revoked",
  ];
  return statuses
    .filter((status) => status === "available" || counts[status] > 0)
    .map((status) => `${t(CODE_STATUS_LABEL_KEY[status])} ${counts[status]}`)
    .join(" · ");
}

export function PrizeTab({
  prizes,
  loading,
  loadError,
  onAdd,
  onEdit,
  onAppendCodes,
  winProbabilityPercent,
  onWinProbabilityChange,
  onWinProbabilitySave,
  winProbabilitySaving,
  winProbabilitySaved,
  winProbabilityError,
}: Props) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminPrize | null>(null);
  const inputProbability = percentToProbability(winProbabilityPercent);

  return (
    <div className={styles.tab}>
      <div className={styles.tabHeader}>
        <h2 className={styles.tabTitle}>{t("jwin.prize.title")}</h2>
        <Button variant="primary" size="md" onClick={() => setAddOpen(true)}>
          {t("jwin.prize.add")}
        </Button>
      </div>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>{t("jwin.basic.winProbability")}</span>
        <div className={styles.inlineControls}>
          <Input
            type="number"
            step="0.01"
            min={0}
            max={MAX_WIN_PROBABILITY * 100}
            value={winProbabilityPercent}
            onChange={onWinProbabilityChange}
            placeholder="0.5"
          />
          <Button
            variant="primary"
            size="md"
            onClick={onWinProbabilitySave}
            loading={winProbabilitySaving}
          >
            {t("jwin.common.save")}
          </Button>
          {winProbabilitySaved && (
            <span className={styles.savedText}>{t("jwin.common.saved")}</span>
          )}
        </div>
        {winProbabilityError ? (
          <span className={styles.errorText}>{winProbabilityError}</span>
        ) : (
          <span className={styles.fieldHint}>{t("jwin.basic.winProbabilityHint")}</span>
        )}
        {/* "%인지 0~1인지" 혼동 방지 — 입력값을 응모 횟수로 즉시 환산해 보여준다 */}
        {inputProbability !== null && inputProbability > 0 && (
          <span className={styles.probabilityPreview}>
            {t("jwin.basic.winProbabilityPreview", {
              percent: winProbabilityPercent,
              per: Math.max(1, Math.round(1 / inputProbability)).toLocaleString(),
            })}
          </span>
        )}
      </div>


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
                <th className={styles.num}>{t("jwin.prize.columns.quantity")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.share")}</th>
                <th className={styles.num}>{t("jwin.prize.columns.codeStock")}</th>
                <th className={styles.actionsHead}>{t("jwin.prize.columns.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <tr key={prize.id}>
                  <td>{prize.name}</td>
                  <td>{t(TYPE_LABEL_KEY[prize.type])}</td>
                  <td className={styles.num}>
                    {prize.remainingQty} / {prize.totalQty}
                  </td>
                  <td className={styles.num}>
                    {formatProbabilityPercent(prizeShare(prize, prizes))}
                  </td>
                  <td className={styles.num}>
                    {prize.type === "CODE"
                      ? codeStatusSummary(prize.codeStatusCounts, t)
                      : t("jwin.common.dash")}
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
