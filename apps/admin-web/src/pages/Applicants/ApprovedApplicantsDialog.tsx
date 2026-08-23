import { Fragment, useEffect, useState } from "react";
import type {
  ApprovedApplicantExportResponse,
  CampaignResponse,
} from "@jsure/shared";
import {
  APPROVED_APPLICANT_EXPORT_HEADER_KEYS,
  approvedApplicantChannelLabel,
  approvedApplicantsCsvFilename,
  buildApprovedApplicantsCsv,
  exportApprovedApplicants,
  formatAppliedAtJst,
  triggerCsvDownload,
  useCampaignOptions,
} from "@/domains/application";
import { getCampaign } from "@/domains/campaign";
import { Button } from "@/components/ui";
import { SnsProfileLink } from "@/components/composites";
import { translate } from "@i18n/admin";
import { getStoredLanguage, useT } from "@/lib/i18n";
import { buildCapacityChips } from "./buildCapacityChips";
import styles from "./ApprovedApplicantsDialog.module.css";

type Props = {
  campaignId?: string;
  onClose: () => void;
};

export function ApprovedApplicantsDialog({ campaignId: fixedCampaignId, onClose }: Props) {
  const t = useT();
  const showCampaignSelector = !fixedCampaignId;
  // 승인자 내보내기는 진행중 캠페인만 대상 — 종료 캠페인은 셀렉트에서 제외.
  const { campaignOptions: allCampaignOptions, loaded: campaignsLoaded } =
    useCampaignOptions();
  const campaignOptions = allCampaignOptions.filter(
    (campaign) => !campaign.closed,
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(fixedCampaignId ?? "");
  const [data, setData] = useState<ApprovedApplicantExportResponse | null>(null);
  const [campaign, setCampaign] = useState<CampaignResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCampaignId) {
      setData(null);
      setCampaign(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCampaign(null);
    // 정원 표시는 부가 정보 — 캠페인 조회가 실패해도 명단은 그대로 보여준다.
    getCampaign(selectedCampaignId)
      .then((response) => {
        if (!cancelled) setCampaign(response);
      })
      .catch(() => {});
    exportApprovedApplicants(selectedCampaignId)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : translate(
                "pages.applicants.approvedDialog.loadFailed",
                getStoredLanguage(),
              ),
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

  const capacityChips =
    data && campaign ? buildCapacityChips(campaign, data.rows, t) : [];

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
            <h2 className={styles.title}>{t("pages.applicants.viewApprovedList")}</h2>
            <p className={styles.sub}>
              {data
                ? t("pages.applicants.approvedDialog.subLoaded", {
                    campaignTitle: data.campaignTitle,
                    count: data.rows.length,
                  })
                : t("pages.applicants.approvedDialog.subEmpty")}
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </div>

        {showCampaignSelector && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="campaign-select">
              {t("domains.application.applicants.table.campaign")}
            </label>
            <select
              id="campaign-select"
              className={styles.select}
              value={selectedCampaignId}
              onChange={(event) => setSelectedCampaignId(event.target.value)}
              disabled={!campaignsLoaded || loading}
            >
              <option value="">
                {campaignsLoaded
                  ? t("pages.applicants.approvedDialog.selectCampaign")
                  : t("common.loading")}
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

        {!loading && capacityChips.length > 0 && (
          <div className={styles.capacityRow}>
            {capacityChips.map((chip) => (
              <span key={chip.key} className={styles.capacityChip}>
                {chip.label}{" "}
                <strong>
                  {chip.approved}/{chip.total}
                </strong>
              </span>
            ))}
          </div>
        )}

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.empty}>{t("common.loading")}</div>
          ) : !selectedCampaignId ? (
            <div className={styles.empty}>
              {t("pages.applicants.approvedDialog.selectCampaignFirst")}
            </div>
          ) : !data || data.rows.length === 0 ? (
            <div className={styles.empty}>
              {t("pages.applicants.approvedDialog.noApproved")}
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  {APPROVED_APPLICANT_EXPORT_HEADER_KEYS.map((headerKey) => (
                    <th key={headerKey}>{t(headerKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.applicationId}>
                    <td>{row.name}</td>
                    <td>{row.nameKana ?? ""}</td>
                    <td>
                      {row.channels
                        .map((channel) => approvedApplicantChannelLabel(channel, t))
                        .join(" / ")}
                    </td>
                    <td>
                      {row.channels.map((channel, index) => (
                        <Fragment key={`${channel.subType}-${index}`}>
                          {index > 0 && " / "}
                          <SnsProfileLink
                            subType={channel.subType}
                            handle={channel.snsHandle}
                          >
                            {channel.snsHandle}
                          </SnsProfileLink>
                        </Fragment>
                      ))}
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
            {t("common.close")}
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={handleDownload}
            disabled={!data || data.rows.length === 0 || loading}
            iconLeft={<i className="fa-solid fa-file-excel" aria-hidden="true" />}
          >
            {t("pages.applicants.approvedDialog.csvDownload")}
          </Button>
        </div>
      </div>
    </div>
  );
}
