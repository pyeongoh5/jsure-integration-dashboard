import {
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { DRAFT_STATUS_OPTIONS, type DraftStatus } from "./types";

type Props = {
  value: Set<DraftStatus>;
  onChange: (next: Set<DraftStatus>) => void;
};

export function DraftStatusFilter({ value, onChange }: Props) {
  return (
    <FilterChipBar>
      <MultiSelectFilterChip
        emptyLabel="+ 상태"
        labelPrefix="상태"
        popoverTitle="상태 선택 (복수 가능)"
        options={DRAFT_STATUS_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </FilterChipBar>
  );
}
