import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { SnsType } from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { PrimaryButton } from "@/components/composites/PrimaryButton";

const schema = z.object({
  url: z
    .string()
    .regex(/^https?:\/\/.+/i, "正しいURLを入力してください"),
});
type Values = z.infer<typeof schema>;

const PLACEHOLDER_BY_SNS: Record<SnsType, string> = {
  INSTAGRAM: "https://www.instagram.com/p/...",
  TIKTOK: "https://www.tiktok.com/@user/video/...",
  X: "https://x.com/user/status/...",
  YOUTUBE: "https://www.youtube.com/watch?v=...",
};

interface Props {
  snsType: SnsType;
  initial: string;
  onSubmit: (url: string) => Promise<void>;
  submitting: boolean;
  postingDeadlineAt: string | null;
}

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function PostSubmitForm({
  snsType,
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
        <FormField name="url" label={`${snsType} 投稿URL`}>
          {(field) => (
            <Input
              id={field.id}
              type="text"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              placeholder={PLACEHOLDER_BY_SNS[snsType]}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "送信中…" : initial ? "投稿URLを更新" : "投稿URLを提出"}
        </PrimaryButton>
        <p
          style={{
            fontSize: 11,
            color: "#6b7280",
            marginTop: 10,
            textAlign: "center",
          }}
        >
          ⚠ 投稿冒頭に #PR を必ず記載
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
            投稿期限: {formatDeadline(postingDeadlineAt)}
          </p>
        )}
      </form>
    </FormProvider>
  );
}
