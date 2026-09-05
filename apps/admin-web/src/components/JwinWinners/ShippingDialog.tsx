import { Button, Dialog } from "@/components/ui";
import type { AdminShipping } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinWinners.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  shipping: AdminShipping | null;
};

/** UTC ISO → "2026-09-01 14:30" (JST, 언어 중립) */
function jstDateTime(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

/**
 * 복호화된 배송지 표시. 열람 자체가 감사 대상이라 목록 응답에 섞지 않고
 * 이 다이얼로그를 열 때만 서버에서 받아온다.
 */
export function ShippingDialog({ open, onClose, loading, error, shipping }: Props) {
  const t = useT();
  const address = shipping?.shipping ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.winner.shipping.title")}
      footer={
        <Button variant="secondary" size="md" onClick={onClose}>
          {t("jwin.winner.shipping.close")}
        </Button>
      }
    >
      <div className={styles.dialogBody}>
        <p className={styles.auditNotice}>{t("jwin.winner.shipping.auditNotice")}</p>

        {loading ? <p>{t("jwin.winner.loading")}</p> : null}
        {error ? <p className={styles.errorText}>{error}</p> : null}
        {!loading && !error && !address ? <p>{t("jwin.winner.shipping.missing")}</p> : null}

        {address ? (
          <dl className={styles.addressList}>
            <dt>{t("jwin.winner.shipping.fullName")}</dt>
            <dd>{address.fullName}</dd>
            <dt>{t("jwin.winner.shipping.postalCode")}</dt>
            <dd>{address.postalCode}</dd>
            <dt>{t("jwin.winner.shipping.prefecture")}</dt>
            <dd>{address.prefecture}</dd>
            <dt>{t("jwin.winner.shipping.address1")}</dt>
            <dd>{address.address1}</dd>
            <dt>{t("jwin.winner.shipping.address2")}</dt>
            <dd>{address.address2 ?? "—"}</dd>
            <dt>{t("jwin.winner.shipping.phone")}</dt>
            <dd>{address.phone}</dd>
            {shipping?.shippingEnteredAt ? (
              <>
                <dt>{t("jwin.winner.shipping.enteredAt")}</dt>
                <dd>{jstDateTime(shipping.shippingEnteredAt)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
      </div>
    </Dialog>
  );
}
