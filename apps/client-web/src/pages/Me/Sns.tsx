import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ENABLED_SNS_TYPES, type SnsAccountSubType } from "@jsure/shared";
import { fetchMe } from "@/domains/auth";
import { deleteSnsAccount, upsertSnsAccount } from "@/domains/me";
import { PageHeader } from "../../components/composites/PageHeader";
import { SnsAccountCard } from "@/domains/auth";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { ErrorBanner } from "../../components/composites/ErrorBanner";

const SNS_TYPES = ENABLED_SNS_TYPES;

const fieldsSchema = z.object({
  enabled: z.boolean(),
  handle: z.string(),
  followerCount: z.string(),
});

const schema = z
  .object({
    instagram: fieldsSchema,
    tiktok: fieldsSchema,
    x: fieldsSchema,
    youtube: fieldsSchema,
  })
  .superRefine((values, ctx) => {
    const keys = Object.keys(values) as Array<keyof typeof values>;
    const enabled = keys.filter((key) => values[key].enabled);
    if (enabled.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "1つ以上のSNSアカウントを追加してください",
        path: ["instagram"],
      });
      return;
    }
    for (const key of enabled) {
      const fields = values[key];
      if (fields.handle.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ハンドルを入力してください",
          path: [key, "handle"],
        });
      }
      if (!/^\d+$/.test(fields.followerCount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "フォロワー数は数字のみ",
          path: [key, "followerCount"],
        });
      }
    }
  });

type Values = z.infer<typeof schema>;
type ValuesKey = keyof Values;

const TYPE_TO_KEY: Record<SnsAccountSubType, ValuesKey> = {
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  X: "x",
  YOUTUBE: "youtube",
};

const EMPTY: Values = {
  instagram: { enabled: false, handle: "", followerCount: "" },
  tiktok: { enabled: false, handle: "", followerCount: "" },
  x: { enabled: false, handle: "", followerCount: "" },
  youtube: { enabled: false, handle: "", followerCount: "" },
};

export function MeSns() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });
  const values = useWatch({ control: methods.control });

  useEffect(() => {
    if (!data) return;
    const next: Values = { ...EMPTY };
    for (const sns of data.snsAccounts) {
      next[TYPE_TO_KEY[sns.snsType]] = {
        enabled: true,
        handle: sns.handle,
        followerCount: String(sns.followerCount),
      };
    }
    methods.reset(next);
  }, [data, methods]);

  const enabledTypes = useMemo(
    () =>
      SNS_TYPES.filter((type) => values?.[TYPE_TO_KEY[type]]?.enabled === true),
    [values],
  );
  const existing = new Set(data?.snsAccounts.map((sns) => sns.snsType) ?? []);

  const upsert = useMutation({
    mutationFn: (snsType: SnsAccountSubType) => {
      const fields = methods.getValues(TYPE_TO_KEY[snsType]);
      return upsertSnsAccount({
        snsType,
        handle: fields.handle.trim(),
        followerCount: Number(fields.followerCount),
      });
    },
  });
  const remove = useMutation({
    mutationFn: (snsType: SnsAccountSubType) => deleteSnsAccount(snsType),
  });

  const isValid =
    enabledTypes.length > 0 &&
    enabledTypes.every((type) => {
      const fields = values?.[TYPE_TO_KEY[type]];
      return (
        !!fields &&
        typeof fields.handle === "string" &&
        fields.handle.trim().length > 0 &&
        typeof fields.followerCount === "string" &&
        /^\d+$/.test(fields.followerCount)
      );
    });

  async function save() {
    setServerError(null);
    const ok = await methods.trigger();
    if (!ok) return;
    try {
      for (const type of enabledTypes) {
        await upsert.mutateAsync(type);
      }
      for (const type of SNS_TYPES) {
        const fields = methods.getValues(TYPE_TO_KEY[type]);
        if (!fields.enabled && existing.has(type)) {
          await remove.mutateAsync(type);
        }
      }
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(error?.response?.data?.message ?? "保存に失敗しました");
    }
  }

  function toggle(type: SnsAccountSubType) {
    const key = TYPE_TO_KEY[type];
    const current = methods.getValues(key);
    methods.setValue(
      key,
      { ...current, enabled: !current.enabled },
      { shouldDirty: true },
    );
  }
  function changeField(
    type: SnsAccountSubType,
    field: "handle" | "followerCount",
    value: string,
  ) {
    const key = TYPE_TO_KEY[type];
    const current = methods.getValues(key);
    methods.setValue(
      key,
      { ...current, [field]: value },
      {
        shouldDirty: true,
        shouldValidate: methods.formState.isSubmitted,
      },
    );
  }

  return (
    <FormProvider {...methods}>
      <PageHeader showBack title="SNSアカウント" />
      <div style={{ padding: 16 }}>
        {serverError && <ErrorBanner message={serverError} />}
        {SNS_TYPES.map((type) => {
          const fields = values?.[TYPE_TO_KEY[type]];
          return (
            <SnsAccountCard
              key={type}
              snsType={type}
              enabled={fields?.enabled === true}
              handle={
                typeof fields?.handle === "string" ? fields.handle : ""
              }
              followerCount={
                typeof fields?.followerCount === "string"
                  ? fields.followerCount
                  : ""
              }
              onToggle={() => toggle(type)}
              onChange={(field, value) => changeField(type, field, value)}
            />
          );
        })}
        <PrimaryButton
          onClick={save}
          disabled={!isValid || upsert.isPending || remove.isPending}
        >
          {upsert.isPending || remove.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </FormProvider>
  );
}
