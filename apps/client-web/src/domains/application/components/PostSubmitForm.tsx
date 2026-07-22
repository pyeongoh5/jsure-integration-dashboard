import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SUB_TYPE_LABEL, type CampaignSubType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";

const urlSchema = z
  .string()
  .regex(/^https?:\/\/.+/i, t("application.postForm.urlInvalid"));

const PLACEHOLDER_BY_SNS: Record<CampaignSubType, string> = {
  INSTAGRAM: "https://www.instagram.com/p/...",
  TIKTOK: "https://www.tiktok.com/@user/video/...",
  X: "https://x.com/user/status/...",
  YOUTUBE: "https://www.youtube.com/watch?v=...",
  QOO10: "https://...",
  LIPS: "https://lipscosme.com/...",
  ATCOSME: "https://www.cosme.net/...",
};

interface Props {
  subTypes: CampaignSubType[]; // 참여한 모든 서브타입의 URL 을 한 폼에서 일괄 제출
  initial: Partial<Record<CampaignSubType, string>>;
  onSubmit: (
    posts: { subType: CampaignSubType; url: string }[],
  ) => Promise<void>;
  submitting: boolean;
  postingDeadlineAt: string | null;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

export function PostSubmitForm({
  subTypes,
  initial,
  onSubmit,
  submitting,
  postingDeadlineAt,
}: Props) {
  const schema = z.object(
    Object.fromEntries(subTypes.map((subType) => [subType, urlSchema])),
  );
  const hasInitial = subTypes.some((subType) => Boolean(initial[subType]));
  const methods = useForm<Record<string, string>>({
    resolver: zodResolver(schema),
    defaultValues: Object.fromEntries(
      subTypes.map((subType) => [subType, initial[subType] ?? ""]),
    ),
  });

  async function handle(values: Record<string, string>) {
    await onSubmit(
      subTypes.map((subType) => ({ subType, url: values[subType] ?? "" })),
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handle)}>
        {subTypes.map((subType) => (
          <FormField
            key={subType}
            name={subType}
            label={`${SUB_TYPE_LABEL[subType]} ${t("application.postForm.labelSuffix")}`}
          >
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
        ))}
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting
            ? t("application.postForm.submitting")
            : hasInitial
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
