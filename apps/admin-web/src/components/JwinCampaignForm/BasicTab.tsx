import { Input } from "@/components/ui";
import type { JwinCampaignFormValues, JwinCampaignFormErrors } from "./useJwinCampaignForm";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  values: JwinCampaignFormValues;
  errors: JwinCampaignFormErrors;
  setField: (field: keyof JwinCampaignFormValues, value: string) => void;
  /** ACTIVE 전환 이후에는 slug 입력 잠금 (게시된 링크 보호, MVP_PLAN §3.3) */
  slugLocked: boolean;
};

export function BasicTab({ values, errors, setField, slugLocked }: Props) {
  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>
          브랜드명<span className={styles.required}>*</span>
        </span>
        <Input
          value={values.brandName}
          onChange={(value) => setField("brandName", value)}
          error={!!errors.brandName}
          placeholder="브랜드명"
        />
        {errors.brandName && <span className={styles.error}>{errors.brandName}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          slug<span className={styles.required}>*</span>
        </span>
        <Input
          value={values.slug}
          onChange={(value) => setField("slug", value)}
          error={!!errors.slug}
          placeholder="brand-campaign-2026"
          disabled={slugLocked}
        />
        {errors.slug ? (
          <span className={styles.error}>{errors.slug}</span>
        ) : (
          <span className={styles.hint}>
            {slugLocked
              ? "ACTIVE 전환 후에는 게시된 링크 보호를 위해 수정할 수 없습니다."
              : "LP 링크에 사용됩니다. 영소문자·숫자·하이픈만."}
          </span>
        )}
      </label>

      <div className={styles.row2}>
        <label className={styles.field}>
          <span className={styles.label}>
            시작일시 (JST)<span className={styles.required}>*</span>
          </span>
          <Input
            type="datetime-local"
            value={values.startsAt}
            onChange={(value) => setField("startsAt", value)}
            error={!!errors.startsAt}
          />
          {errors.startsAt && <span className={styles.error}>{errors.startsAt}</span>}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            종료일시 (JST)<span className={styles.required}>*</span>
          </span>
          <Input
            type="datetime-local"
            value={values.endsAt}
            onChange={(value) => setField("endsAt", value)}
            error={!!errors.endsAt}
          />
          {errors.endsAt && <span className={styles.error}>{errors.endsAt}</span>}
        </label>
      </div>

      <div className={styles.row2}>
        <label className={styles.field}>
          <span className={styles.label}>
            매일 게시 시각<span className={styles.required}>*</span>
          </span>
          <Input
            type="time"
            value={values.dailyPostTime}
            onChange={(value) => setField("dailyPostTime", value)}
          />
          <span className={styles.hint}>JST 기준</span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>일일 당첨 상한</span>
          <Input
            type="number"
            min={1}
            value={values.dailyWinCap}
            onChange={(value) => setField("dailyWinCap", value)}
            error={!!errors.dailyWinCap}
            placeholder="비우면 무제한"
          />
          {errors.dailyWinCap && <span className={styles.error}>{errors.dailyWinCap}</span>}
        </label>
      </div>
    </div>
  );
}
