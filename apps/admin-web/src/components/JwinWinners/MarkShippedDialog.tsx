import { Button, Dialog } from "@/components/ui";
import type { AdminWinner } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinWinners.module.css";

type Props = {
  open: boolean;
  winner: AdminWinner | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
};

/** 발송 완료 확인. READY → SHIPPED 는 서버가 되돌려주지 않으므로 한 번 묻는다. */
export function MarkShippedDialog({
  open,
  winner,
  onClose,
  onConfirm,
  pending,
  error,
}: Props) {
  const t = useT();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.winner.shipDialog.title")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            {t("jwin.winner.shipDialog.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {t("jwin.winner.shipDialog.confirm")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        {winner ? (
          <p>
            {t("jwin.winner.shipDialog.body", {
              account: winner.xUsername ? `@${winner.xUsername}` : "—",
              prize: winner.prizeName,
            })}
          </p>
        ) : null}
        {error ? <p className={styles.errorText}>{error}</p> : null}
      </div>
    </Dialog>
  );
}
