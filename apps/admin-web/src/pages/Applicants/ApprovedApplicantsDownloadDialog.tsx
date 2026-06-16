import { useState } from "react";
import {
  approvedApplicantsCsvFilename,
  buildApprovedApplicantsCsv,
  exportApprovedApplicants,
  triggerCsvDownload,
  useCampaignOptions,
} from "@/domains/application";
import styles from "./ApprovedApplicantsDownloadDialog.module.css";

type Props = {
  onClose: () => void;
};

export function ApprovedApplicantsDownloadDialog({ onClose }: Props) {
  const { campaignOptions, loaded } = useCampaignOptions();
  const [campaignId, setCampaignId] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (!campaignId) {
      setError("캠페인을 선택해 주세요");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const response = await exportApprovedApplicants(campaignId);
      const csv = buildApprovedApplicantsCsv(response);
      triggerCsvDownload(
        approvedApplicantsCsvFilename(response.campaignTitle),
        csv,
      );
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>승인자 명단 다운로드</h2>
            <p className={styles.sub}>
              선택한 캠페인의 승인된 응모자 명단(CSV)을 다운로드합니다.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="campaign-select">
            캠페인
          </label>
          <select
            id="campaign-select"
            className={styles.select}
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            disabled={!loaded || downloading}
          >
            <option value="">
              {loaded ? "캠페인을 선택하세요" : "불러오는 중…"}
            </option>
            {campaignOptions.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btn}
            onClick={onClose}
            disabled={downloading}
          >
            취소
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleDownload}
            disabled={downloading || !campaignId}
          >
            {downloading ? "생성 중…" : "다운로드"}
          </button>
        </div>
      </div>
    </div>
  );
}
