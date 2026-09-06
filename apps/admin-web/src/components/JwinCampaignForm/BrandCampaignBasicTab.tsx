import { Input } from "@/components/ui";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
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
 * 참여의 게시 설정. 기간·이름은 시즌이 갖고 여기서 바꾸지 않는다 —
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

      <div className={styles.row2}>
        <label className={styles.field}>
          <span className={styles.label}>
            {t("jwin.basic.dailyPostTime")}
            <span className={styles.required}>*</span>
          </span>
          <Input
            type="time"
            value={values.dailyPostTime}
            onChange={(value) => setField("dailyPostTime", value)}
          />
          <span className={styles.hint}>{t("jwin.basic.dailyPostTimeHint")}</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("jwin.basic.dailyWinCap")}</span>
          <Input
            type="number"
            min={1}
            value={values.dailyWinCap}
            onChange={(value) => setField("dailyWinCap", value)}
            placeholder={t("jwin.basic.dailyWinCapPlaceholder")}
          />
        </label>
      </div>
    </div>
  );
}
