import { Input } from "@/components/ui";
import { MAX_WIN_PROBABILITY, type AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { utcIsoToJstLocal } from "./jwinDateTime";
import type { JwinBrandCampaignFormValues } from "./useJwinBrandCampaign";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminBrandCampaignDetail;
  values: JwinBrandCampaignFormValues;
  setField: (field: keyof JwinBrandCampaignFormValues, value: string) => void;
};

/** UTC ISO → "9/1 00:00" (JST, 언어 중립) */
function shortJst(iso: string): string {
  const [date = "", time = ""] = utcIsoToJstLocal(iso).split("T");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${time}`;
}

/**
 * 참여의 추첨 설정. 기간·이름·게시 시각은 시즌이 갖고 여기서 바꾸지 않는다 —
 * 대신 어느 시즌·어느 브랜드인지 요약으로 보여준다.
 */
export function BrandCampaignBasicTab({ detail, values, setField }: Props) {
  const t = useT();

  return (
    <div className={styles.form}>
      <div className={styles.summary}>
        <strong>{detail.campaign.name}</strong>
        <span>
          {shortJst(detail.campaign.startsAt)} ~ {shortJst(detail.campaign.endsAt)}
        </span>
        <span>{detail.brandAccount.label}</span>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>{t("jwin.basic.winProbability")}</span>
        <Input
          type="number"
          step="0.01"
          min={0}
          max={MAX_WIN_PROBABILITY * 100}
          value={values.winProbabilityPercent}
          onChange={(value) => setField("winProbabilityPercent", value)}
          placeholder="0.5"
        />
        <span className={styles.hint}>{t("jwin.basic.winProbabilityHint")}</span>
      </label>
    </div>
  );
}
