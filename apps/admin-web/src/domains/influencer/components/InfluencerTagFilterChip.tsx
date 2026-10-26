import { useT } from "@/lib/i18n";
import { MultiSelectFilterChip } from "@/components/composites/FilterChip";
import { useInfluencerTags } from "../useInfluencerTags";

type Props = {
  value: Set<string>;
  onChange: (next: Set<string>) => void;
};

/**
 * 어드민 관리 태그로 목록을 좁히는 칩. 인플루언서 관리·응모자 관리가 함께 쓴다.
 * 선택지는 태그 마스터 전체 — 아직 아무에게도 안 붙은 태그도 후보로 둔다(선택하면 "총 0명").
 * 마스터가 비어 있으면 고를 게 없으니 칩 자체를 감춘다.
 */
export function InfluencerTagFilterChip({ value, onChange }: Props) {
  const t = useT();
  const tags = useInfluencerTags();
  if (tags.length === 0) return null;

  return (
    <MultiSelectFilterChip
      emptyLabel={t("domains.influencer.tagFilter.chipEmpty")}
      labelPrefix={t("domains.influencer.tagFilter.prefix")}
      popoverTitle={t("domains.influencer.tagFilter.title")}
      options={tags.map((tag) => ({ key: tag.id, label: tag.label }))}
      value={value}
      onChange={onChange}
    />
  );
}
