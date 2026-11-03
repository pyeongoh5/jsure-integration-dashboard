import type { Residence } from "@jsure/shared";
import { useT } from "@/lib/i18n";
import { SingleSelectFilterChip } from "@/components/composites/FilterChip";
import { RESIDENCE_LABEL_KEY, RESIDENCE_ORDER } from "../residenceLabel";

type Props = {
  value: Residence | null;
  onChange: (next: Residence | null) => void;
};

/**
 * 배송지 주소 기준 거주지로 목록을 좁히는 칩. 인플루언서 관리·응모자 관리가 함께 쓴다.
 * 한국 발송 전용 캠페인처럼 거주 국가가 선정 조건인 경우에 쓴다.
 */
export function ResidenceFilterChip({ value, onChange }: Props) {
  const t = useT();

  return (
    <SingleSelectFilterChip
      emptyLabel={t("domains.influencer.residence.chipEmpty")}
      labelPrefix={t("domains.influencer.residence.label")}
      popoverTitle={t("domains.influencer.residence.filterTitle")}
      options={RESIDENCE_ORDER.map((residence) => ({
        key: residence,
        label: t(RESIDENCE_LABEL_KEY[residence]),
      }))}
      value={value}
      onChange={onChange}
    />
  );
}
