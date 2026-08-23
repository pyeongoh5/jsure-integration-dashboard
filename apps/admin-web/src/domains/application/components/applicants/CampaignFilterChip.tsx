import { useState } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { useT } from "@/lib/i18n";
import { foldForSearch } from "@/lib/searchText";
import { FilterChip } from "@/components/composites/FilterChip";
import { TagChip } from "@/components/composites";
import styles from "@/components/composites/FilterChip/FilterChip.module.css";
import type { CampaignOption } from "./types";

// 팝오버 상단 상태 세그먼트. 옵션의 closed 값으로 목록을 좁힌다.
type CampaignStatusScope = "ongoing" | "all" | "closed";

const STATUS_SCOPE_META: Record<
  CampaignStatusScope,
  { labelKey: AdminTranslationKey; emptyMessageKey: AdminTranslationKey }
> = {
  ongoing: {
    labelKey: "domains.application.applicants.campaignFilter.scopeOngoing",
    emptyMessageKey: "domains.application.applicants.campaignFilter.emptyOngoing",
  },
  all: {
    labelKey: "domains.application.applicants.campaignFilter.scopeAll",
    emptyMessageKey: "domains.application.applicants.campaignFilter.emptyAll",
  },
  closed: {
    labelKey: "domains.application.applicants.campaignFilter.scopeClosed",
    emptyMessageKey: "domains.application.applicants.campaignFilter.emptyClosed",
  },
};

/** 세그먼트 노출 순서. 넓은 범위에서 좁혀가는 순서로 읽히도록 전체를 앞에 둔다. */
const STATUS_SCOPES: CampaignStatusScope[] = ["all", "ongoing", "closed"];

/**
 * 검색 대상 문자열. 태그는 배지로 그리지만 검색어로는 계속 잡혀야 한다
 * — 전에는 제목이 "[태그] 제목" 이라 태그 이름으로도 찾을 수 있었다.
 */
function searchHaystack(campaign: CampaignOption): string {
  const tags = campaign.tags ?? [];
  return tags.length > 0 ? `${tags.join(" ")} ${campaign.title}` : campaign.title;
}

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
  popoverTitle,
  emptyMessage,
}: Props) {
  const t = useT();
  const resolvedPopoverTitle =
    popoverTitle ??
    (showStatusSegments
      ? t("domains.application.applicants.campaignFilter.title")
      : t("domains.application.applicants.campaignFilter.titleOngoing"));
  const resolvedEmptyMessage =
    emptyMessage ?? t("domains.application.applicants.campaignFilter.emptyOngoing");
  const resolved =
    campaignLabel ??
    (campaignsLoaded
      ? campaignId
      : t("domains.application.applicants.campaignFilter.loading"));
  const activeLabel = campaignId
    ? t("domains.application.applicants.campaignFilter.activeLabel", {
        title: resolved ?? "",
      })
    : null;

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel={t("domains.application.applicants.campaignFilter.chipEmpty")}
      onClear={() => onCampaignChange(null)}
      popoverTitle={resolvedPopoverTitle}
      renderPopover={(close) => (
        <CampaignPopover
          campaignId={campaignId}
          campaignOptions={campaignOptions}
          showStatusSegments={showStatusSegments}
          emptyMessage={resolvedEmptyMessage}
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
  const t = useT();
  const [query, setQuery] = useState("");
  const [statusScope, setStatusScope] =
    useState<CampaignStatusScope>("ongoing");

  const scoped = showStatusSegments
    ? campaignOptions.filter((campaign) =>
        matchesStatusScope(campaign, statusScope),
      )
    : campaignOptions;
  const normalized = foldForSearch(query.trim());
  const filtered = normalized
    ? scoped.filter((campaign) =>
        foldForSearch(searchHaystack(campaign)).includes(normalized),
      )
    : scoped;
  const resolvedEmptyMessage = showStatusSegments
    ? t(STATUS_SCOPE_META[statusScope].emptyMessageKey)
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
              {t(STATUS_SCOPE_META[scope].labelKey)}
            </button>
          ))}
        </div>
      )}
      <div className={styles.popoverInputRow}>
        <input
          type="text"
          className={styles.popoverInput}
          placeholder={t("domains.application.applicants.campaignFilter.searchPlaceholder")}
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {scoped.length === 0 ? (
        <div className={styles.popoverEmpty}>{resolvedEmptyMessage}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.popoverEmpty}>
          {t("domains.application.applicants.campaignFilter.noSearchResults")}
        </div>
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
                {campaign.tags?.map((tag) => (
                  <TagChip key={tag} tag={tag} />
                ))}
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
          {t("common.close")}
        </button>
      </div>
    </>
  );
}
