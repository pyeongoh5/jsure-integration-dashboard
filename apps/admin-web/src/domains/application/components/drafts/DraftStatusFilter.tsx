import {
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { useT } from "@/lib/i18n";
import { DRAFT_STATUS_OPTIONS, type DraftStatus } from "./types";

type Props = {
  value: Set<DraftStatus>;
  onChange: (next: Set<DraftStatus>) => void;
};

export function DraftStatusFilter({ value, onChange }: Props) {
  const t = useT();
  const options = DRAFT_STATUS_OPTIONS.map((option) => ({
    key: option.key,
    label: t(option.label),
  }));

  return (
    <FilterChipBar>
      <MultiSelectFilterChip
        emptyLabel={t("domains.application.applicants.statusFilter.chipEmpty")}
        labelPrefix={t("domains.application.applicants.statusFilter.prefix")}
        popoverTitle={t("domains.application.applicants.statusFilter.title")}
        options={options}
        value={value}
        onChange={onChange}
      />
    </FilterChipBar>
  );
}
