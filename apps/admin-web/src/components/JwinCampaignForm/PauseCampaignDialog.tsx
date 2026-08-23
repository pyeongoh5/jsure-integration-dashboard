import { Button, Dialog } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 일시중지 확인. 되돌릴 수 있으므로 경고 수위가 낮다. */
export function PauseCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.status.pauseTitle")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? t("jwin.status.changing") : t("jwin.status.pause")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t("jwin.status.pauseBody")}</p>
      </div>
    </Dialog>
  );
}
