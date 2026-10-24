import { useState } from "react";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { Button } from "@/components/ui";
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
  // 이미 배송 시작된 건(사후 등록)은 번호를 넣으러 여는 팝업이라 번호가 필수다.
  // 배송 시작 단계에서는 송장 채번 전 선발송을 허용한다.
  const isLateTrackingEntry = applicant.status === "SHIPPING";
  // 번호 없이 보내는 길은 별도 버튼으로 분리한다 — 빈 칸으로 확인을 누르는
  // 실수와 의도한 선발송을 구분하기 위해.
  const canSubmit = !!resolvedCarrier && !!trimmedNumber;
  const canShipWithoutTracking = !!resolvedCarrier && !trimmedNumber;

  return (
    <ConfirmDialog
      open
      title={t(
        isLateTrackingEntry
          ? "domains.application.applicants.shipDialog.lateTitle"
          : "domains.application.applicants.shipDialog.title",
      )}
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
            {!isLateTrackingEntry && (
              <p className={styles.shipHelp}>
                {t("domains.application.applicants.shipDialog.trackingOptionalHelp")}
              </p>
            )}
          </div>

          {error && <div className={styles.mutationError}>{error}</div>}
        </div>
      }
      confirmLabel={t(
        isLateTrackingEntry
          ? "domains.application.applicants.shipDialog.lateConfirm"
          : "domains.application.applicants.shipDialog.confirm",
      )}
      cancelLabel={t("common.cancel")}
      secondaryAction={
        isLateTrackingEntry ? undefined : (
          <Button
            variant="secondary"
            size="md"
            disabled={mutating || !canShipWithoutTracking}
            onClick={() => onConfirm(resolvedCarrier, "")}
          >
            {t("domains.application.applicants.shipDialog.shipWithoutTracking")}
          </Button>
        )
      }
      tone="primary"
      busy={mutating}
      confirmDisabled={!canSubmit}
      onConfirm={() => onConfirm(resolvedCarrier, trimmedNumber)}
      onCancel={onCancel}
    />
  );
}
