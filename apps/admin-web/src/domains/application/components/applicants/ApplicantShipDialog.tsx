import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";
import styles from "@/pages/Applicants/Applicants.module.css";
import type { Applicant } from "./types";

// label 은 저장되는 택배사명 그대로 (고유명사) — custom 만 UI 에서 번역해 표시한다.
const CARRIERS = [
  { id: "yamato", label: "ヤマト運輸" },
  { id: "sagawa", label: "佐川急便" },
  { id: "jp", label: "日本郵便" },
  { id: "kse", label: "KSE" },
  { id: "custom", label: "" },
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
  const known = CARRIERS.find((c) => c.id !== "custom" && c.label === label.trim());
  if (known) return { carrierId: known.id, customLabel: "" };
  return { carrierId: "custom", customLabel: label };
}

export function ApplicantShipDialog({ applicant, mutating, error, onConfirm, onCancel }: Props) {
  const t = useT();
  const init = initialCarrierId(applicant.trackingCarrier);
  const [carrierId, setCarrierId] = useState<CarrierId>(init.carrierId);
  const [customLabel, setCustomLabel] = useState(init.customLabel);
  const [trackingNumber, setTrackingNumber] = useState(applicant.trackingNumber ?? "");

  const resolvedCarrier =
    carrierId === "custom"
      ? customLabel.trim()
      : (CARRIERS.find((c) => c.id === carrierId)?.label ?? "");
  const trimmedNumber = trackingNumber.trim();
  const canSubmit = !!resolvedCarrier && !!trimmedNumber;

  return (
    <ConfirmDialog
      open
      title={t("domains.application.applicants.shipDialog.title")}
      subtitle={
        <div className={styles.shipForm}>
          <div className={styles.shipField}>
            <label className={styles.shipLabel}>{t("domains.application.applicants.shipDialog.carrier")}</label>
            <select
              className={styles.trackingInput}
              value={carrierId}
              onChange={(e) => setCarrierId(e.target.value as CarrierId)}
              disabled={mutating}
            >
              {CARRIERS.map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.id === "custom"
                    ? t("domains.application.applicants.shipDialog.customCarrierOption")
                    : carrier.label}
                </option>
              ))}
            </select>
          </div>

          {carrierId === "custom" && (
            <div className={styles.shipField}>
              <label className={styles.shipLabel}>{t("domains.application.applicants.shipDialog.carrierName")}</label>
              <input
                type="text"
                className={styles.trackingInput}
                placeholder={t("domains.application.applicants.shipDialog.customCarrierPlaceholder")}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                disabled={mutating}
              />
            </div>
          )}

          <div className={styles.shipField}>
            <label className={styles.shipLabel}>{t("domains.application.applicants.shipDialog.trackingNumber")}</label>
            <input
              type="text"
              className={styles.trackingInput}
              placeholder={t("domains.application.applicants.shipDialog.trackingNumber")}
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              disabled={mutating}
              autoFocus
            />
          </div>

          {error && <div className={styles.mutationError}>{error}</div>}
        </div>
      }
      confirmLabel={t("domains.application.applicants.shipDialog.confirm")}
      cancelLabel={t("common.cancel")}
      tone="primary"
      busy={mutating}
      confirmDisabled={!canSubmit}
      onConfirm={() => onConfirm(resolvedCarrier, trimmedNumber)}
      onCancel={onCancel}
    />
  );
}
