import { useState } from "react";
import { FilterChip } from "@/components/composites/FilterChip";
import styles from "@/components/composites/FilterChip/FilterChip.module.css";
import type { CampaignOption } from "./types";

// 팝오버 상단 상태 세그먼트. 옵션의 closed 값으로 목록을 좁힌다.
type CampaignStatusScope = "ongoing" | "all" | "closed";

const STATUS_SCOPE_META: Record<
  CampaignStatusScope,
  { label: string; emptyMessage: string }
> = {
  ongoing: { label: "진행중", emptyMessage: "진행중인 캠페인이 없습니다." },
  all: { label: "전체", emptyMessage: "캠페인이 없습니다." },
  closed: { label: "종료", emptyMessage: "종료된 캠페인이 없습니다." },
};

const STATUS_SCOPES = Object.keys(STATUS_SCOPE_META) as CampaignStatusScope[];

function matchesStatusScope(
  campaign: CampaignOption,
  statusScope: CampaignStatusScope,
): boolean {
  if (statusScope === "all") return true;
  return statusScope === "closed" ? campaign.closed === true : !campaign.closed;
}

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (null while loading or unknown id)
  campaignsLoaded: boolean;
  campaignOptions: CampaignOption[];
  onCampaignChange: (id: string | null) => void;
  // 진행중/전체/종료 세그먼트. 옵션에 closed 를 채워주는 화면에서만 켠다.
  showStatusSegments?: boolean;
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
  showStatusSegments = false,
  popoverTitle = showStatusSegments ? "캠페인 선택" : "캠페인 선택 (진행중)",
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
          showStatusSegments={showStatusSegments}
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

// 팝오버는 열릴 때마다 새로 mount 되므로 검색어·세그먼트 state 가 매번 초기화된다.
function CampaignPopover({
  campaignId,
  campaignOptions,
  showStatusSegments,
  emptyMessage,
  onSelect,
  onClose,
}: {
  campaignId: string | null;
  campaignOptions: CampaignOption[];
  showStatusSegments: boolean;
  emptyMessage: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [statusScope, setStatusScope] =
    useState<CampaignStatusScope>("ongoing");

  const scoped = showStatusSegments
    ? campaignOptions.filter((campaign) =>
        matchesStatusScope(campaign, statusScope),
      )
    : campaignOptions;
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? scoped.filter((campaign) =>
        campaign.title.toLowerCase().includes(normalized),
      )
    : scoped;
  const resolvedEmptyMessage = showStatusSegments
    ? STATUS_SCOPE_META[statusScope].emptyMessage
    : emptyMessage;

  return (
    <>
      {showStatusSegments && (
        <div className={styles.popoverSegments}>
          {STATUS_SCOPES.map((scope) => (
            <button
              key={scope}
              type="button"
              className={`${styles.popoverSegment}${scope === statusScope ? ` ${styles.popoverSegmentOn}` : ""}`}
              onClick={() => setStatusScope(scope)}
            >
              {STATUS_SCOPE_META[scope].label}
            </button>
          ))}
        </div>
      )}
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
      {scoped.length === 0 ? (
        <div className={styles.popoverEmpty}>{resolvedEmptyMessage}</div>
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
