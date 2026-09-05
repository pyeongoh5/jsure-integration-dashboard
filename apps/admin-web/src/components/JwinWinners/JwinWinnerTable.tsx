import { Button } from "@/components/ui";
import type { AdminWinner } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinWinners.module.css";

type Props = {
  winners: AdminWinner[];
  onViewShipping: (winner: AdminWinner) => void;
  onMarkShipped: (winner: AdminWinner) => void;
};

/** UTC ISO → "9/1 14:30" (JST, 언어 중립) */
function shortJst(iso: string): string {
  const jst = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000).toISOString();
  const [date = "", rest = ""] = jst.split("T");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${rest.slice(0, 5)}`;
}

export function JwinWinnerTable({ winners, onViewShipping, onMarkShipped }: Props) {
  const t = useT();

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>{t("jwin.winner.columns.date")}</th>
          <th>{t("jwin.winner.columns.account")}</th>
          <th>{t("jwin.winner.columns.prize")}</th>
          <th>{t("jwin.winner.columns.type")}</th>
          <th>{t("jwin.winner.columns.verification")}</th>
          <th>{t("jwin.winner.columns.fulfillment")}</th>
          <th>{t("jwin.winner.columns.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {winners.map((winner) => (
          <tr key={winner.id}>
            <td>{winner.dateJst}</td>
            <td>{winner.xUsername ? `@${winner.xUsername}` : "—"}</td>
            <td>{winner.prizeName}</td>
            <td>
              {t(
                winner.prizeType === "PHYSICAL"
                  ? "jwin.prize.type.physical"
                  : "jwin.prize.type.code",
              )}
            </td>
            <td>{t(`jwin.winner.verification.${winner.verification}` as const)}</td>
            <td>
              <span>{t(`jwin.winner.fulfillment.${winner.fulfillment}` as const)}</span>
              {winner.prizeType === "CODE" ? (
                <span className={styles.subText}>
                  {winner.dmSentAt
                    ? t("jwin.winner.dmSentAt", { datetime: shortJst(winner.dmSentAt) })
                    : t("jwin.winner.dmNotSent")}
                </span>
              ) : null}
              {winner.dmError ? <span className={styles.errorText}>{winner.dmError}</span> : null}
            </td>
            <td>
              {/* CODE 경품은 DM 자동 발송이라 손댈 액션이 없다 (MVP_PLAN §3.4) */}
              {winner.prizeType === "PHYSICAL" ? (
                <div className={styles.rowActions}>
                  {winner.hasShipping ? (
                    <Button variant="secondary" onClick={() => onViewShipping(winner)}>
                      {t("jwin.winner.viewShipping")}
                    </Button>
                  ) : (
                    <span className={styles.subText}>{t("jwin.winner.noShipping")}</span>
                  )}
                  {winner.fulfillment === "READY" ? (
                    <Button onClick={() => onMarkShipped(winner)}>
                      {t("jwin.winner.markShipped")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
