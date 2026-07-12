import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { CampaignSubType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";

// new — SIMPLE_REVIEW 리뷰 URL 제출 폼. https URL 하나만 받는다.
const schema = z.object({
  url: z
    .string()
    .regex(/^https:\/\/.+/i, t("application.simpleReviewForm.urlInvalid")),
});
type Values = z.infer<typeof schema>;

const PLACEHOLDER_BY_SUB_TYPE: Partial<Record<CampaignSubType, string>> = { // new
  LIPS: "https://lipscosme.com/...",
  ATCOSME: "https://www.cosme.net/...",
};

interface Props { // new
  subType: CampaignSubType;
  initial: string;
  onSubmit: (url: string) => Promise<void>;
  submitting: boolean;
  reviewDeadlineAt: string | null;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

export function SimpleReviewSubmitForm({ // new
  subType,
  initial,
  onSubmit,
  submitting,
  reviewDeadlineAt,
}: Props) {
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { url: initial },
  });

  async function handle(values: Values) {
    await onSubmit(values.url);
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handle)}>
        <FormField
          name="url"
          label={`${subType} ${t("application.simpleReviewForm.labelSuffix")}`}
        >
          {(field) => (
            <Input
              id={field.id}
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder={PLACEHOLDER_BY_SUB_TYPE[subType] ?? "https://..."}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting
            ? t("application.simpleReviewForm.submitting")
            : initial
              ? t("application.simpleReviewForm.update")
              : t("application.simpleReviewForm.submit")}
        </PrimaryButton>
        {reviewDeadlineAt && (
          <p
            style={{
              fontSize: 11,
              color: "#dc2626",
              marginTop: 4,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {t("application.simpleReviewForm.deadlineLabelPrefix")}
            {formatDeadline(reviewDeadlineAt)}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
