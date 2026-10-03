import { Link } from "react-router-dom";
import { JwinAccountStatusBadge } from "@/components/composites";
import { Input } from "@/components/ui";
import type { AdminBrandCampaignDetail } from "@/domains/jwin";
import { useT } from "@/lib/i18n";
import { utcIsoToJstLocal } from "./jwinDateTime";
import type { JwinBrandCampaignFormValues } from "./useJwinBrandCampaign";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  detail: AdminBrandCampaignDetail;
  values: JwinBrandCampaignFormValues;
  setField: <Field extends keyof JwinBrandCampaignFormValues>(
    field: Field,
    value: JwinBrandCampaignFormValues[Field],
  ) => void;
};

/** UTC ISO → "9/1 00:00" (JST, 언어 중립) */
function shortJst(iso: string): string {
  const [date = "", time = ""] = utcIsoToJstLocal(iso).split("T");
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)} ${time}`;
}

/**
 * 참여 설정 — 어느 시즌·어느 브랜드인지, X 계정 연동 상태, 추첨 설정.
 * 기간·이름·게시 시각은 시즌이 갖고 여기서 바꾸지 않는다.
 * 연동은 읽기 전용이다 — 연동·재연동 링크 발급은 브랜드 관리 화면에서 한다.
 */
export function BrandCampaignBasicTab({ detail, values, setField }: Props) {
  const t = useT();
  const account = detail.brandAccount;

  return (
    <div className={styles.form}>
      <div className={styles.summary}>
        <strong>{detail.campaign.name}</strong>
        <span>
          {shortJst(detail.campaign.startsAt)} ~ {shortJst(detail.campaign.endsAt)}
        </span>
        <span>{account.label}</span>
      </div>

      <div className={styles.statusRow}>
        <span className={styles.label}>{t("jwin.connect.status")}</span>
        <JwinAccountStatusBadge status={account.status} />
        {account.xUsername && <span>@{account.xUsername}</span>}
      </div>

      {/* 연동이 안 된 상태에서만 안내한다 — 정상일 때는 배지로 충분 */}
      {account.status !== "CONNECTED" && (
        <p className={styles.note}>
          {t("jwin.connect.connectNote")}{" "}
          <a href={account.connectUrl} target="_blank" rel="noreferrer">
            {account.connectUrl}
          </a>
          <br />
          {t("jwin.connect.manageNote")}{" "}
          <Link to="/jwin/accounts">{t("jwin.connect.manageLink")}</Link>
        </p>
      )}

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
  );
}
