import { ConfirmDialog } from "@/ui/ConfirmDialog";

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
  return (
    <ConfirmDialog
      open={open}
      title="공지사항을 삭제하시겠습니까?"
      subtitle={title}
      confirmLabel="삭제"
      cancelLabel="취소"
      tone="danger"
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
