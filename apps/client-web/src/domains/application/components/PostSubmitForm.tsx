import { useForm, FormProvider, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  SUB_TYPE_LABEL,
  type CampaignSubType,
  type CrossPost,
  type CrossPostInput,
} from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";
import { t } from "@i18n";
import { CrossPostSection } from "./CrossPostSection";
import { PublishWindowNotice } from "./PublishWindowNotice";
import type { PublishWindowText } from "../publishWindowText";

const urlSchema = z
  .string()
  .regex(/^https?:\/\/.+/i, t("application.postForm.urlInvalid"));

/** 추가 공유 한 행. 플랫폼이 "기타" 일 때만 플랫폼명을 받는다. */
const crossPostRowSchema = z
  .object({
    platform: z.string().min(1, t("application.crossPost.platformRequired")), // new
    platformName: z.string(),
    url: urlSchema,
  })
  .superRefine((row, ctx) => {
    if (row.platform === "OTHER" && row.platformName.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["platformName"],
        message: t("application.crossPost.nameRequired"), // new
      });
    }
  });

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
  /** 기존에 제출한 추가 공유 — 그대로 프리필되고 제출 시 통째로 교체된다. */
  initialCrossPosts: CrossPost[];
  onSubmit: (
    posts: { subType: CampaignSubType; url: string }[],
    crossPosts: CrossPostInput[],
  ) => Promise<void>;
  submitting: boolean;
  postingDeadlineAt: string | null;
  publishWindow: PublishWindowText;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}${t("application.dateFormat.monthSuffix")}${date.getDate()}${t("application.dateFormat.daySuffix")}`;
}

type Values = Record<string, unknown>;

export function PostSubmitForm({
  subTypes,
  initial,
  initialCrossPosts,
  onSubmit,
  submitting,
  postingDeadlineAt,
  publishWindow,
}: Props) {
  const schema = z.object({
    ...Object.fromEntries(subTypes.map((subType) => [subType, urlSchema])),
    crossPosts: z.array(crossPostRowSchema),
  });
  const hasInitial = subTypes.some((subType) => Boolean(initial[subType]));
  const methods = useForm<Values>({
    // 참여 서브타입에 따라 필드가 달라져 스키마를 런타임에 만든다 — 정적 추론이 불가능한 지점.
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: {
      ...Object.fromEntries(
        subTypes.map((subType) => [subType, initial[subType] ?? ""]),
      ),
      crossPosts: initialCrossPosts.map((crossPost) => ({
        platform: crossPost.platform,
        platformName: crossPost.platformName ?? "",
        url: crossPost.url,
      })),
    },
  });

  async function handle(values: Values) {
    const rows = (values.crossPosts ?? []) as {
      platform: string;
      platformName: string;
      url: string;
    }[];
    await onSubmit(
      subTypes.map((subType) => ({
        subType,
        url: (values[subType] as string) ?? "",
      })),
      rows.map((row) => ({
        platform: row.platform as CrossPostInput["platform"],
        // 기타가 아니면 서버가 플랫폼명을 거부하므로 아예 보내지 않는다.
        platformName:
          row.platform === "OTHER" ? row.platformName.trim() : undefined,
        url: row.url,
      })),
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
        <CrossPostSection
          participatingSubTypes={subTypes}
          defaultOpen={initialCrossPosts.length > 0}
          disabled={submitting}
        />
        <PrimaryButton
          type="submit"
          disabled={submitting || publishWindow.state === "BEFORE"}
          style={{ marginTop: 18 }}
        >
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
        <PublishWindowNotice window={publishWindow} />
        {publishWindow.state === "NONE" && postingDeadlineAt && (
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
