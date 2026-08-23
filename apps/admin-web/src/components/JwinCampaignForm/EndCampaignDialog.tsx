import { Button, Dialog } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 종료 확인. 되돌릴 수 없고 배송지 입력이 즉시 잠기므로 경고 박스로 명시한다. */
export function EndCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.status.endTitle")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? t("jwin.status.ending") : t("jwin.status.end")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <div className={styles.warning}>{t("jwin.status.endWarning")}</div>
        <p>{t("jwin.status.endQuestion")}</p>
      </div>
    </Dialog>
  );
}
