import { useFieldArray, useFormContext } from "react-hook-form";
import {
  CROSS_POST_PLATFORM_LABEL,
  CrossPostPlatformSchema,
  MAX_CROSS_POSTS,
  type CampaignSubType,
  type CrossPostPlatform,
} from "@jsure/shared";
import { Input, Select } from "@/components/ui";
import { FormField } from "@/components/composites";
import { t } from "@i18n";
import styles from "./CrossPostSection.module.css";

interface Props {
  /** 이번 응모의 참여 서브타입 — 본 투고와 중복되므로 선택지에서 제외한다. */
  participatingSubTypes: CampaignSubType[];
  /** 기존 제출값이 있으면 섹션을 펼친 채로 시작한다. */
  defaultOpen: boolean;
  disabled: boolean;
}

/**
 * 투고 폼 하단의 "다른 곳에도 공유하셨나요?" 선택 입력 섹션.
 * 부모 폼의 `crossPosts` 필드 배열을 다룬다.
 */
export function CrossPostSection({
  participatingSubTypes,
  defaultOpen,
  disabled,
}: Props) {
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name: "crossPosts" });

  const platformOptions = CrossPostPlatformSchema.options
    .filter(
      (platform) =>
        !participatingSubTypes.includes(platform as CampaignSubType),
    )
    .map((platform: CrossPostPlatform) => ({
      value: platform,
      label:
        platform === "OTHER"
          ? t("application.crossPost.platformOther") // new
          : CROSS_POST_PLATFORM_LABEL[platform],
    }));

  return (
    <details className={styles.section} open={defaultOpen}>
      <summary className={styles.summary}>
        {t("application.crossPost.title")} {/* new */}
      </summary>
      <p className={styles.hint}>
        {t("application.crossPost.hint")} {/* new */}
      </p>

      {fields.map((field, index) => (
        <div key={field.id} className={styles.row}>
          <div className={styles.platform}>
            <FormField name={`crossPosts.${index}.platform`}>
              {(cell) => (
                <Select
                  id={cell.id}
                  value={cell.value}
                  onChange={cell.onChange}
                  onBlur={cell.onBlur}
                  options={platformOptions}
                  placeholder={t("application.crossPost.platformPlaceholder")} // new
                  error={cell.error}
                  disabled={disabled}
                  aria-invalid={cell["aria-invalid"]}
                />
              )}
            </FormField>
          </div>

          {watch(`crossPosts.${index}.platform`) === "OTHER" && (
            <div className={styles.name}>
              <FormField name={`crossPosts.${index}.platformName`}>
                {(cell) => (
                  <Input
                    id={cell.id}
                    type="text"
                    value={cell.value}
                    onChange={cell.onChange}
                    onBlur={cell.onBlur}
                    error={cell.error}
                    disabled={disabled}
                    placeholder={t("application.crossPost.namePlaceholder")} // new
                    aria-invalid={cell["aria-invalid"]}
                  />
                )}
              </FormField>
            </div>
          )}

          <div className={styles.url}>
            <FormField name={`crossPosts.${index}.url`}>
              {(cell) => (
                <Input
                  id={cell.id}
                  type="text"
                  value={cell.value}
                  onChange={cell.onChange}
                  onBlur={cell.onBlur}
                  error={cell.error}
                  disabled={disabled}
                  placeholder="https://..."
                  aria-invalid={cell["aria-invalid"]}
                />
              )}
            </FormField>
          </div>

          <button
            type="button"
            className={styles.remove}
            onClick={() => remove(index)}
            disabled={disabled}
            aria-label={t("application.crossPost.removeAriaLabel")} // new
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.add}
        onClick={() => append({ platform: "", platformName: "", url: "" })}
        disabled={disabled || fields.length >= MAX_CROSS_POSTS}
      >
        {t("application.crossPost.add")} {/* new */}
      </button>
    </details>
  );
}
