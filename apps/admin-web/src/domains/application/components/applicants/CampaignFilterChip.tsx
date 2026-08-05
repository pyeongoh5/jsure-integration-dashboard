import { useState } from "react";
import { FilterChip } from "@/components/composites/FilterChip";
import styles from "@/components/composites/FilterChip/FilterChip.module.css";
import type { CampaignOption } from "./types";

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (null while loading or unknown id)
  campaignsLoaded: boolean;
  campaignOptions: CampaignOption[];
  onCampaignChange: (id: string | null) => void;
  // 후보 캠페인의 범위가 화면마다 달라 문구를 받는다. 기본값은 응모 관리 기준.
  popoverTitle?: string;
  emptyMessage?: string;
};

export function CampaignFilterChip({
  campaignId,
  campaignLabel,
  campaignsLoaded,
  campaignOptions,
  onCampaignChange,
  popoverTitle = "캠페인 선택 (진행중)",
  emptyMessage = "진행중인 캠페인이 없습니다.",
}: Props) {
  const resolved = campaignLabel ?? (campaignsLoaded ? campaignId : "불러오는 중…");
  const activeLabel = campaignId ? `캠페인: ${resolved}` : null;

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel="+ 캠페인"
      onClear={() => onCampaignChange(null)}
      popoverTitle={popoverTitle}
      renderPopover={(close) => (
        <CampaignPopover
          campaignId={campaignId}
          campaignOptions={campaignOptions}
          emptyMessage={emptyMessage}
          onSelect={(id) => {
            onCampaignChange(id);
            close();
          }}
          onClose={close}
        />
      )}
    />
  );
}

// 팝오버는 열릴 때마다 새로 mount 되므로 검색어 state 가 매번 초기화된다.
function CampaignPopover({
  campaignId,
  campaignOptions,
  emptyMessage,
  onSelect,
  onClose,
}: {
  campaignId: string | null;
  campaignOptions: CampaignOption[];
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? campaignOptions.filter((campaign) =>
        campaign.title.toLowerCase().includes(normalized),
      )
    : campaignOptions;

  return (
    <>
      <div className={styles.popoverInputRow}>
        <input
          type="text"
          className={styles.popoverInput}
          placeholder="캠페인 검색"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {campaignOptions.length === 0 ? (
        <div className={styles.popoverEmpty}>{emptyMessage}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.popoverEmpty}>검색 결과가 없습니다.</div>
      ) : (
        <div className={`${styles.popoverItems} ${styles.popoverItemsScroll}`}>
          {filtered.map((campaign) => {
            const selected = campaign.id === campaignId;
            return (
              <button
                key={campaign.id}
                type="button"
                className={`${styles.popoverOption}${selected ? ` ${styles.popoverOptionOn}` : ""}`}
                onClick={() => onSelect(campaign.id)}
              >
                <span className={styles.popoverOptionLabel}>{campaign.title}</span>
                {selected && (
                  <i className={`fa-solid fa-check ${styles.popoverOptionCheck}`} />
                )}
              </button>
            );
          })}
        </div>
      )}
      <div className={styles.popoverActions}>
        <button
          type="button"
          className={styles.popoverBtnPrimary}
          onClick={onClose}
        >
          닫기
        </button>
      </div>
    </>
  );
}
