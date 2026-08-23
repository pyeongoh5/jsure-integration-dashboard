import { Button, Dialog } from "@/components/ui";
import { useT } from "@/lib/i18n";
import styles from "./JwinCampaignTabs.module.css";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

/** 일시중지 해제 확인. 다음 게시 시각부터 자동 게시가 다시 나간다. */
export function ResumeCampaignDialog({ open, onClose, onConfirm, pending }: Props) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("jwin.status.resumeTitle")}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={pending}>
            {t("jwin.common.cancel")}
          </Button>
          <Button variant="primary" size="md" onClick={onConfirm} disabled={pending}>
            {pending ? t("jwin.status.changing") : t("jwin.status.resume")}
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <p>{t("jwin.status.resumeBody")}</p>
      </div>
    </Dialog>
  );
}
