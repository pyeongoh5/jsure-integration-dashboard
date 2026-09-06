import { Input } from "@/components/ui";
import { useT } from "@/lib/i18n";
import type { JwinCampaignFormValues, JwinCampaignFormErrors } from "./useJwinCampaignForm";
import styles from "./JwinCampaignForm.module.css";

type Props = {
  values: JwinCampaignFormValues;
  errors: JwinCampaignFormErrors;
  setField: (field: keyof JwinCampaignFormValues, value: string) => void;
  /** 참여가 하나라도 ACTIVE 면 slug 입력 잠금 (게시된 링크 보호, MVP_PLAN §3.3) */
  slugLocked: boolean;
};

export function BasicTab({ values, errors, setField, slugLocked }: Props) {
  const t = useT();

  return (
    <div className={styles.form}>
      <label className={styles.field}>
        <span className={styles.label}>
          {t("jwin.basic.name")}
          <span className={styles.required}>*</span>
        </span>
        <Input
          value={values.name}
          onChange={(value) => setField("name", value)}
          error={!!errors.name}
          placeholder={t("jwin.basic.namePlaceholder")}
        />
        {errors.name && <span className={styles.error}>{errors.name}</span>}
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          {t("jwin.basic.slug")}
          <span className={styles.required}>*</span>
        </span>
        <Input
          value={values.slug}
          onChange={(value) => setField("slug", value)}
          error={!!errors.slug}
          placeholder={t("jwin.basic.slugPlaceholder")}
          disabled={slugLocked}
        />
        {errors.slug ? (
          <span className={styles.error}>{errors.slug}</span>
        ) : (
          <span className={styles.hint}>
            {slugLocked ? t("jwin.basic.slugLockedHint") : t("jwin.basic.slugHint")}
          </span>
        )}
      </label>

      <div className={styles.row2}>
        <label className={styles.field}>
          <span className={styles.label}>
            {t("jwin.basic.startsAt")}
            <span className={styles.required}>*</span>
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
            {t("jwin.basic.endsAt")}
            <span className={styles.required}>*</span>
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

    </div>
  );
}
