import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";

type Props = {
  open: boolean;
  title: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function NoticeDeleteDialog({
  open,
  title,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  return (
    <ConfirmDialog
      open={open}
      title={t("domains.notice.deleteDialog.title")}
      subtitle={title}
      confirmLabel={t("domains.notice.deleteDialog.confirm")}
      cancelLabel={t("common.cancel")}
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
