import type { CampaignCategory } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import {
  FilterChipBar,
  SingleSelectFilterChip,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { CampaignFilterChip } from "./CampaignFilterChip";
import { MinFollowersFilterChip } from "./MinFollowersFilterChip";
import {
  CATEGORY_FILTER_OPTIONS,
  MEDIA_META,
  type CampaignOption,
  type Media,
} from "./types";

const MEDIA_OPTIONS = (Object.keys(MEDIA_META) as Media[]).map((media) => ({
  key: media,
  label: MEDIA_META[media].label,
  icon: MEDIA_META[media].icon,
}));

type Props = {
  campaignId: string | null;
  campaignLabel: string | null; // resolved title (null while loading or unknown id)
  campaignsLoaded: boolean;
  campaignOptions: CampaignOption[]; // 전체 캠페인 (closed 포함, 세그먼트로 구분)
  onCampaignChange: (id: string | null) => void;

  mediaFilter: Set<Media>;
  onMediaChange: (next: Set<Media>) => void;

  // 팔로워 필터는 응모 관리 페이지 전용 — props 를 생략하면 칩이 사라진다.
  minFollowers?: number | null;
  onMinFollowersChange?: (followers: number | null) => void;

  // 카테고리 필터도 응모 관리 페이지 전용. props 를 생략하면 칩이 사라진다.
  category?: CampaignCategory | null;
  onCategoryChange?: (category: CampaignCategory | null) => void;
};

export function ApplicantFilters({
  campaignId,
  campaignLabel,
  campaignsLoaded,
  campaignOptions,
  onCampaignChange,
  mediaFilter,
  onMediaChange,
  minFollowers,
  onMinFollowersChange,
  category,
  onCategoryChange,
}: Props) {
  const t = useT();
  const categoryOptions = CATEGORY_FILTER_OPTIONS.map((option) => ({
    key: option.key,
    label: t(option.label),
  }));

  return (
    <FilterChipBar>
      <CampaignFilterChip
        campaignId={campaignId}
        campaignLabel={campaignLabel}
        campaignsLoaded={campaignsLoaded}
        campaignOptions={campaignOptions}
        onCampaignChange={onCampaignChange}
        showStatusSegments
      />

      {onCategoryChange && (
        <SingleSelectFilterChip
          emptyLabel={t("domains.application.applicants.categoryFilter.chipEmpty")}
          labelPrefix={t("domains.application.applicants.categoryFilter.prefix")}
          popoverTitle={t("domains.application.applicants.categoryFilter.title")}
          options={categoryOptions}
          value={category ?? null}
          onChange={onCategoryChange}
        />
      )}

      {onMinFollowersChange && (
        <MinFollowersFilterChip
          value={minFollowers ?? null}
          onChange={onMinFollowersChange}
        />
      )}

      <MultiSelectFilterChip
        emptyLabel={t("domains.application.applicants.subTypeFilter.chipEmpty")}
        labelPrefix={t("domains.application.applicants.subTypeFilter.prefix")}
        popoverTitle={t("domains.application.applicants.subTypeFilter.title")}
        options={MEDIA_OPTIONS}
        value={mediaFilter}
        onChange={onMediaChange}
      />
    </FilterChipBar>
  );
}
