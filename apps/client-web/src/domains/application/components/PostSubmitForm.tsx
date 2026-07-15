import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SUB_TYPE_LABEL, type CampaignSubType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";

const schema = z.object({
  url: z.string().regex(/^https?:\/\/.+/i, t("application.postForm.urlInvalid")),
});
type Values = z.infer<typeof schema>;

const PLACEHOLDER_BY_SNS: Record<CampaignSubType, string> = {
  INSTAGRAM: "https://www.instagram.com/p/...",
  TIKTOK: "https://www.tiktok.com/@user/video/...",
  X: "https://x.com/user/status/...",
  YOUTUBE: "https://www.youtube.com/watch?v=...",
  QOO10: "https://...",
  LIPS: "https://lipscosme.com/...", // new
  ATCOSME: "https://www.cosme.net/...", // new
};

interface Props {
  subType: CampaignSubType;
  initial: string;
  onSubmit: (url: string) => Promise<void>;
  submitting: boolean;
  postingDeadlineAt: string | null;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

export function PostSubmitForm({
  subType,
  initial,
  onSubmit,
  submitting,
  postingDeadlineAt,
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
        <FormField name="url" label={`${SUB_TYPE_LABEL[subType]} ${t("application.postForm.labelSuffix")}`}>
          {(field) => (
            <Input
              id={field.id}
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder={PLACEHOLDER_BY_SNS[subType]}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting
            ? t("application.postForm.submitting")
            : initial
              ? t("application.postForm.update")
              : t("application.postForm.submit")}
        </PrimaryButton>
        <p
          style={{
            fontSize: 11,
            color: "#6b7280",
            marginTop: 10,
            textAlign: "center",
          }}
        >
          {t("application.postForm.prHint")}
        </p>
        {postingDeadlineAt && (
          <p
            style={{
              fontSize: 11,
              color: "#dc2626",
              marginTop: 4,
              textAlign: "center",
              fontWeight: 600,
            }}
          >
            {/* 게시 마감일 */}
            {t("application.postForm.deadlineLabelPrefix")}
            {formatDeadline(postingDeadlineAt)}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
