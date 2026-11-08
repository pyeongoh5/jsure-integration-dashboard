import type { WithdrawalFilter } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import { SingleSelectFilterChip } from "@/components/composites/FilterChip";
import { WITHDRAWAL_DECISION_LABEL_KEY } from "@/components/composites";

/** 반려는 재신청으로 덮이므로 "현재 상태" 판정이 성립하지 않아 선택지에 두지 않는다. */
const FILTER_ORDER: WithdrawalFilter[] = ["PENDING", "APPROVED"];

type Props = {
  value: WithdrawalFilter | null;
  onChange: (next: WithdrawalFilter | null) => void;
};

export function WithdrawalFilterChip({ value, onChange }: Props) {
  const t = useT();

  return (
    <SingleSelectFilterChip
      emptyLabel={t("domains.influencer.withdrawal.chipEmpty")}
      labelPrefix={t("domains.influencer.withdrawal.prefix")}
      popoverTitle={t("domains.influencer.withdrawal.filterTitle")}
      options={FILTER_ORDER.map((decision) => ({
        key: decision,
        label: t(WITHDRAWAL_DECISION_LABEL_KEY[decision]),
      }))}
      value={value}
      onChange={onChange}
    />
  );
}
