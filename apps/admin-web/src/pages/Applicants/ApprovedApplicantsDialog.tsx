import { useEffect, useState } from "react";
import type {
  ApprovedApplicantExportResponse,
  CampaignSubType,
} from "@jsure/shared";
import {
  approvedApplicantsCsvFilename,
  buildApprovedApplicantsCsv,
  exportApprovedApplicants,
  formatAppliedAtJst,
  triggerCsvDownload,
  useCampaignOptions,
} from "@/domains/application";
import { Button } from "@/components/ui";
import styles from "./ApprovedApplicantsDialog.module.css";

type Props = {
  campaignId?: string;
  onClose: () => void;
};

const SNS_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

export function ApprovedApplicantsDialog({ campaignId: fixedCampaignId, onClose }: Props) {
  const showCampaignSelector = !fixedCampaignId;
  const { campaignOptions, loaded: campaignsLoaded } = useCampaignOptions();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(fixedCampaignId ?? "");
  const [data, setData] = useState<ApprovedApplicantExportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCampaignId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    exportApprovedApplicants(selectedCampaignId)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  function handleDownload() {
    if (!data) return;
    const csv = buildApprovedApplicantsCsv(data);
    triggerCsvDownload(approvedApplicantsCsvFilename(data.campaignTitle), csv);
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
            <h2 className={styles.title}>승인자 명단 보기</h2>
            <p className={styles.sub}>
              {data
                ? `${data.campaignTitle} · ${data.rows.length}명 (신청일 최신순)`
                : "선택한 캠페인의 승인된 응모자 명단을 조회합니다."}
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

        {showCampaignSelector && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-select">
              캠페인
            </label>
            <select
              id="campaign-select"
              className={styles.select}
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              disabled={!campaignsLoaded || loading}
            >
              <option value="">
                {campaignsLoaded ? "캠페인을 선택하세요" : "불러오는 중…"}
              </option>
              {campaignOptions.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.empty}>불러오는 중…</div>
          ) : !selectedCampaignId ? (
            <div className={styles.empty}>캠페인을 먼저 선택해 주세요.</div>
          ) : !data || data.rows.length === 0 ? (
            <div className={styles.empty}>승인된 응모자가 없습니다.</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이름(한자)</th>
                  <th>이름(카타카나)</th>
                  <th>SNS</th>
                  <th>SNS ID</th>
                  <th>프로필 URL</th>
                  <th>전화번호</th>
                  <th>우편번호</th>
                  <th>주소</th>
                  <th>캠페인 신청날짜</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.applicationId}>
                    <td>{row.name}</td>
                    <td>{row.nameKana ?? ""}</td>
                    <td>
                      {row.channels
                        .map((channel) => SNS_LABEL[channel.subType])
                        .join(" / ")}
                    </td>
                    <td>
                      {row.channels
                        .map((channel) => channel.snsHandle)
                        .join(" / ")}
                    </td>
                    <td>
                      {row.channels
                        .map((channel) => channel.profileUrl)
                        .filter((profileUrl) => profileUrl !== "")
                        .join(" / ")}
                    </td>
                    <td>{row.phone}</td>
                    <td>{row.postalCode}</td>
                    <td>{row.address}</td>
                    <td>{formatAppliedAtJst(row.appliedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={styles.actions}>
          <Button variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={handleDownload}
            disabled={!data || data.rows.length === 0 || loading}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            CSV 다운로드
          </Button>
        </div>
      </div>
    </div>
  );
}
