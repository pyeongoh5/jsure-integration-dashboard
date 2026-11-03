import { useMemo, useState } from "react";
import type { CampaignResponse } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import { foldForSearch } from "@/lib/searchText";
import styles from "./ExcludedCampaignsPicker.module.css";

type Props = {
  allCampaigns: CampaignResponse[] | null;
  /** 편집 모드일 때 자기 자신은 선택지에서 제외 */
  selfId?: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /**
   * 승인(선정) 인원수를 함께 표시한다. 대상자 지정에서만 켠다 — 거기서는 이 숫자가
   * 곧 "불러올 인원"이라, 0명인 캠페인을 고르는 혼선을 미리 막는다.
   * 참여 제외는 완료(제출물 승인) 기준이라 이 숫자와 축이 달라 켜지 않는다.
   */
  showApprovedCount?: boolean;
};

export function ExcludedCampaignsPicker({
  allCampaigns,
  selfId,
  value,
  onChange,
  disabled,
  showApprovedCount,
}: Props) {
  const t = useT();
  const [query, setQuery] = useState("");

  const candidates = useMemo(() => {
    if (!allCampaigns) return [];
    return allCampaigns.filter((campaign) => campaign.id !== selfId);
  }, [allCampaigns, selfId]);

  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const normalized = foldForSearch(query.trim());
    if (!normalized) return candidates;
    return candidates.filter((campaign) =>
      foldForSearch(campaign.title).includes(normalized),
    );
  }, [candidates, query]);

  const selectedRows = useMemo(
    () => candidates.filter((campaign) => valueSet.has(campaign.id)),
    [candidates, valueSet],
  );

  const toggle = (id: string) => {
    if (valueSet.has(id)) {
      onChange(value.filter((current) => current !== id));
    } else {
      onChange([...value, id]);
    }
  };

  if (allCampaigns === null) {
    return <div className={styles.hint}>{t("domains.campaign.excludedPicker.loading")}</div>;
  }
  if (candidates.length === 0) {
    return <div className={styles.hint}>{t("domains.campaign.excludedPicker.noCandidates")}</div>;
  }

  return (
    <div className={styles.root}>
      <div className={styles.selected}>
        {selectedRows.length === 0 ? (
          <div className={styles.empty}>{t("domains.campaign.excludedPicker.noneSelected")}</div>
        ) : (
          selectedRows.map((campaign) => (
            <span key={campaign.id} className={styles.chip}>
              {campaign.title}
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => toggle(campaign.id)}
                disabled={disabled}
                aria-label={t("domains.campaign.excludedPicker.removeAria")}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      <input
        type="text"
        className={styles.search}
        placeholder={t("domains.campaign.excludedPicker.searchPlaceholder")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled}
      />

      <div className={styles.list}>
        {filtered.length === 0 ? (
          <div className={styles.empty}>
            {t("domains.application.applicants.campaignFilter.noSearchResults")}
          </div>
        ) : (
          filtered.map((campaign) => {
            const checked = valueSet.has(campaign.id);
            return (
              <label
                key={campaign.id}
                className={`${styles.row} ${checked ? styles.rowChecked : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(campaign.id)}
                  disabled={disabled}
                />
                <span className={styles.rowTitle}>{campaign.title}</span>
                <span className={styles.rowMeta}>
                  {campaign.recruitStartDate} ~ {campaign.recruitEndDate}
                </span>
                {showApprovedCount && (
                  <span
                    className={
                      campaign.approvedCount === 0
                        ? styles.rowCountEmpty
                        : styles.rowCount
                    }
                  >
                    {t("domains.campaign.excludedPicker.approvedCount", {
                      count: campaign.approvedCount,
                    })}
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
