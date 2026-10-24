import { useState } from "react";
import { CancelReasonCategorySchema, type CancelReasonCategory } from "@jsure/shared";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Checkbox } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { CANCEL_REASON_CATEGORY_LABELS } from "../cancelReason";
import styles from "./ForceCancelDialog.module.css";

const CATEGORIES = CancelReasonCategorySchema.options;

type Props = {
  /** 화면 상단에 보여줄 대상 — 인플루언서·캠페인·현재 단계 */
  influencerName: string;
  handle?: string | null;
  campaignTitle: string;
  statusLabel: string;
  mutating: boolean;
  error: string | null;
  onConfirm: (reasonCategory: CancelReasonCategory, reason: string) => void;
  onCancel: () => void;
};

/**
 * 응모 강제 취소 확인. 응모자 관리와 제출물 검토가 같은 액션을 쓰므로 한 컴포넌트를 공유한다.
 * 되돌릴 수 없으므로 사유 입력과 재확인 체크를 모두 요구한다.
 */
export function ForceCancelDialog({
  influencerName,
  handle,
  campaignTitle,
  statusLabel,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const t = useT();
  const [reasonCategory, setReasonCategory] =
    useState<CancelReasonCategory>("INFLUENCER_CIRCUMSTANCE");
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <ConfirmDialog
      open
      tone="danger"
      busy={mutating}
      confirmDisabled={reason.trim() === "" || !acknowledged}
      title={t("domains.application.forceCancel.title")}
      subtitle={
        <span className={styles.body}>
          <span className={styles.target}>
            {influencerName}
            {handle ? ` (@${handle})` : ""} — {campaignTitle}
          </span>
          <span className={styles.stage}>
            {t("domains.application.forceCancel.currentStage", { stage: statusLabel })}
          </span>
          <span className={styles.warning}>
            {t("domains.application.forceCancel.warning")}
          </span>
          <select
            className={styles.category}
            value={reasonCategory}
            onChange={(event) =>
              setReasonCategory(
                CancelReasonCategorySchema.parse(event.target.value),
              )
            }
            disabled={mutating}
            aria-label={t("domains.application.forceCancel.reasonCategoryLabel")}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(CANCEL_REASON_CATEGORY_LABELS[category])}
              </option>
            ))}
          </select>
          <textarea
            className={styles.reason}
            placeholder={t("domains.application.forceCancel.reasonPlaceholder")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={mutating}
            autoFocus
          />
          <Checkbox
            checked={acknowledged}
            onChange={setAcknowledged}
            disabled={mutating}
            label={t("domains.application.forceCancel.acknowledge")}
          />
          {error && <span className={styles.error}>{error}</span>}
        </span>
      }
      confirmLabel={
        mutating
          ? t("components.confirmDialog.processing")
          : t("domains.application.forceCancel.confirm")
      }
      cancelLabel={t("common.cancel")}
      onConfirm={() => onConfirm(reasonCategory, reason.trim())}
      onCancel={onCancel}
    />
  );
}
