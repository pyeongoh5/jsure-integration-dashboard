import {
  FulfillmentStatusSchema,
  PrizeTypeSchema,
  VerificationStatusSchema,
  type AdminWinnerFilter,
} from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import styles from "./JwinWinners.module.css";

type Props = {
  filter: AdminWinnerFilter;
  onChange: (filter: AdminWinnerFilter) => void;
  disabled: boolean;
};

const VERIFICATION_VALUES = VerificationStatusSchema.options;
const FULFILLMENT_VALUES = FulfillmentStatusSchema.options;
const PRIZE_TYPE_VALUES = PrizeTypeSchema.options;

/** 빈 문자열을 "전체"(필터 없음)로 읽는다. 서버가 조건을 걸므로 값만 올려보낸다. */
function pickValue<T extends string>(raw: string): T | undefined {
  return raw === "" ? undefined : (raw as T);
}

export function JwinWinnerFilters({ filter, onChange, disabled }: Props) {
  const t = useT();

  return (
    <div className={styles.filters}>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>{t("jwin.winner.filter.verification")}</span>
        <select
          className={styles.select}
          value={filter.verification ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...filter, verification: pickValue(event.target.value) })
          }
        >
          <option value="">{t("jwin.winner.filter.all")}</option>
          {VERIFICATION_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`jwin.winner.verification.${value}` as const)}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterField}>
        <span className={styles.filterLabel}>{t("jwin.winner.filter.fulfillment")}</span>
        <select
          className={styles.select}
          value={filter.fulfillment ?? ""}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...filter, fulfillment: pickValue(event.target.value) })
          }
        >
          <option value="">{t("jwin.winner.filter.all")}</option>
          {FULFILLMENT_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(`jwin.winner.fulfillment.${value}` as const)}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.filterField}>
        <span className={styles.filterLabel}>{t("jwin.winner.filter.prizeType")}</span>
        <select
          className={styles.select}
          value={filter.prizeType ?? ""}
          disabled={disabled}
          onChange={(event) => onChange({ ...filter, prizeType: pickValue(event.target.value) })}
        >
          <option value="">{t("jwin.winner.filter.all")}</option>
          {PRIZE_TYPE_VALUES.map((value) => (
            <option key={value} value={value}>
              {t(value === "PHYSICAL" ? "jwin.prize.type.physical" : "jwin.prize.type.code")}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
