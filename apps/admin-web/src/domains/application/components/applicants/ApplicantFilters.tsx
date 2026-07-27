import type { CampaignCategory } from "@jsure/shared";
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
  campaignOptions: CampaignOption[]; // already filtered to non-closed
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
  return (
    <FilterChipBar>
      <CampaignFilterChip
        campaignId={campaignId}
        campaignLabel={campaignLabel}
        campaignsLoaded={campaignsLoaded}
        campaignOptions={campaignOptions}
        onCampaignChange={onCampaignChange}
      />

      {onCategoryChange && (
        <SingleSelectFilterChip
          emptyLabel="+ 카테고리"
          labelPrefix="카테고리"
          popoverTitle="카테고리 선택"
          options={CATEGORY_FILTER_OPTIONS}
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
        emptyLabel="+ 서브타입"
        labelPrefix="서브타입"
        popoverTitle="서브타입 선택 (복수 가능)"
        options={MEDIA_OPTIONS}
        value={mediaFilter}
        onChange={onMediaChange}
      />
    </FilterChipBar>
  );
}
