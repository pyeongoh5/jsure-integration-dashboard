import type { PublicAdminUser } from "@jsure/shared";
import {
  FilterChip,
  FilterChipBar,
  MultiSelectFilterChip,
} from "@/components/composites/FilterChip";
import popoverStyles from "@/components/composites/FilterChip/FilterChip.module.css";
import { adminUserLabel } from "@/domains/team";
import { useT } from "@/lib/i18n";

const MAX_VISIBLE_MANAGER_LABELS = 2;

type Props = {
  value: string[];
  onChange: (managerIds: string[]) => void;
  managers: PublicAdminUser[];
  /** 담당자 후보 로딩 실패 메시지. 있으면 팝오버에 빈 목록 대신 이 메시지를 보인다. */
  error?: string | null;
};

/** 운영 담당자 다중 선택 chip. 옵션 목록은 호출부가 useAdminUserOptions 로 가져와 넘긴다. */
export function CampaignManagerPicker({ value, onChange, managers, error }: Props) {
  const t = useT();
  const emptyLabel = t("domains.campaign.managers.chipEmpty");
  const popoverTitle = t("domains.campaign.managers.popoverTitle");

  if (error) {
    return (
      <FilterChipBar>
        <FilterChip
          activeLabel={null}
          emptyLabel={emptyLabel}
          popoverTitle={popoverTitle}
          renderPopover={() => <div className={popoverStyles.popoverEmpty}>{error}</div>}
        />
      </FilterChipBar>
    );
  }

  const options = managers.map((manager) => ({
    key: manager.id,
    label: adminUserLabel(manager),
  }));

  return (
    <FilterChipBar>
      <MultiSelectFilterChip
        emptyLabel={emptyLabel}
        labelPrefix={t("domains.campaign.managers.label")}
        popoverTitle={popoverTitle}
        options={options}
        value={new Set(value)}
        onChange={(next) => onChange([...next])}
        maxVisibleLabels={MAX_VISIBLE_MANAGER_LABELS}
      />
    </FilterChipBar>
  );
}
