import type { PublicAdminUser } from "@jsure/shared";
import { FilterChipBar, MultiSelectFilterChip } from "@/components/composites/FilterChip";
import { adminUserLabel } from "@/domains/team";
import { useT } from "@/lib/i18n";

const MAX_VISIBLE_MANAGER_LABELS = 2;

type Props = {
  value: string[];
  onChange: (managerIds: string[]) => void;
  managers: PublicAdminUser[];
};

/** 운영 담당자 다중 선택 chip. 옵션 목록은 호출부가 useAdminUserOptions 로 가져와 넘긴다. */
export function CampaignManagerPicker({ value, onChange, managers }: Props) {
  const t = useT();
  const options = managers.map((manager) => ({
    key: manager.id,
    label: adminUserLabel(manager),
  }));

  return (
    <FilterChipBar>
      <MultiSelectFilterChip
        emptyLabel={t("domains.campaign.managers.chipEmpty")}
        labelPrefix={t("domains.campaign.managers.label")}
        popoverTitle={t("domains.campaign.managers.popoverTitle")}
        options={options}
        value={new Set(value)}
        onChange={(next) => onChange([...next])}
        maxVisibleLabels={MAX_VISIBLE_MANAGER_LABELS}
      />
    </FilterChipBar>
  );
}
