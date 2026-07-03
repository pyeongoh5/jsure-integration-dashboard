import { Button, Dialog } from "@/components/ui";
import type { Applicant } from "@/domains/application";

type Props = {
  applicant: Applicant;
  onClose: () => void;
};

export function ApplicantDetailDialog({ applicant, onClose }: Props) {
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${applicant.name} 상세`}
      footer={
        <Button variant="secondary" size="md" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div>준비 중</div>
    </Dialog>
  );
}
