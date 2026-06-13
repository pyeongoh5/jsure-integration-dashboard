import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import styles from "@/pages/Applicants/Applicants.module.css";
import type { Applicant } from "./types";

const CARRIERS = [
  { id: "yamato", label: "ヤマト運輸" },
  { id: "sagawa", label: "佐川急便" },
  { id: "jp", label: "日本郵便" },
  { id: "custom", label: "직접 입력" },
] as const;

type CarrierId = (typeof CARRIERS)[number]["id"];

type Props = {
  applicant: Applicant;
  mutating: boolean;
  error: string | null;
  onConfirm: (trackingCarrier: string, trackingNumber: string) => void;
  onCancel: () => void;
};

function initialCarrierId(label: string | null | undefined): {
  carrierId: CarrierId;
  customLabel: string;
} {
  if (!label) return { carrierId: "yamato", customLabel: "" };
  const known = CARRIERS.find(
    (c) => c.id !== "custom" && c.label === label.trim(),
  );
  if (known) return { carrierId: known.id, customLabel: "" };
  return { carrierId: "custom", customLabel: label };
}

export function ApplicantShipDialog({
  applicant,
  mutating,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const init = initialCarrierId(applicant.trackingCarrier);
  const [carrierId, setCarrierId] = useState<CarrierId>(init.carrierId);
  const [customLabel, setCustomLabel] = useState(init.customLabel);
  const [trackingNumber, setTrackingNumber] = useState(
    applicant.trackingNumber ?? "",
  );

  const resolvedCarrier =
    carrierId === "custom"
      ? customLabel.trim()
      : CARRIERS.find((c) => c.id === carrierId)?.label ?? "";
  const trimmedNumber = trackingNumber.trim();
  const canSubmit = !!resolvedCarrier && !!trimmedNumber;

  return (
    <ConfirmDialog
      open
      title="운송장 정보를 입력하세요"
      subtitle={
        <div className={styles.shipForm}>
          <div className={styles.shipField}>
            <label className={styles.shipLabel}>택배사</label>
            <select
              className={styles.trackingInput}
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value as CarrierId)}
              disabled={mutating}
            >
              {CARRIERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {carrierId === "custom" && (
            <div className={styles.shipField}>
              <label className={styles.shipLabel}>택배사명</label>
              <input
                type="text"
                className={styles.trackingInput}
                placeholder="택배사 이름 직접 입력"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                disabled={mutating}
              />
            </div>
          )}

          <div className={styles.shipField}>
            <label className={styles.shipLabel}>운송장 번호</label>
            <input
              type="text"
              className={styles.trackingInput}
              placeholder="운송장 번호"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              disabled={mutating}
              autoFocus
            />
          </div>

          {error && <div className={styles.mutationError}>{error}</div>}
        </div>
      }
      confirmLabel="배송 시작"
      cancelLabel="취소"
      tone="primary"
      busy={mutating}
      confirmDisabled={!canSubmit}
      onConfirm={() => onConfirm(resolvedCarrier, trimmedNumber)}
      onCancel={onCancel}
    />
  );
}
