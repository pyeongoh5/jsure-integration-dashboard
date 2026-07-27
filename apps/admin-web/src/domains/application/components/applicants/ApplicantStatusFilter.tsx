import {
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import { APPLICANT_STATUS_OPTIONS, type ApplicantStatus } from "./types";

type Props = {
  value: Set<ApplicantStatus>;
  onChange: (next: Set<ApplicantStatus>) => void;
};

export function ApplicantStatusFilter({ value, onChange }: Props) {
  return (
    <FilterChipBar>
      <MultiSelectFilterChip
        emptyLabel="+ 상태"
        labelPrefix="상태"
        popoverTitle="상태 선택 (복수 가능)"
        options={APPLICANT_STATUS_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </FilterChipBar>
  );
}
