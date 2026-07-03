import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ENABLED_SNS_TYPES, type SnsAccountSubType } from "@jsure/shared";
import { SnsAccountCard } from "@/domains/auth";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";

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
    const enabled = (Object.keys(values) as Array<keyof typeof values>).filter(
      (key) => values[key].enabled,
    );
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

function buildDefaults(
  existing: { snsType: SnsAccountSubType; handle: string; followerCount: number }[],
): Values {
  const base: Values = {
    instagram: { enabled: false, handle: "", followerCount: "" },
    tiktok: { enabled: false, handle: "", followerCount: "" },
    x: { enabled: false, handle: "", followerCount: "" },
    youtube: { enabled: false, handle: "", followerCount: "" },
  };
  for (const entry of existing) {
    base[TYPE_TO_KEY[entry.snsType]] = {
      enabled: true,
      handle: entry.handle,
      followerCount: String(entry.followerCount),
    };
  }
  return base;
}

export function SignupSns() {
  const nav = useNavigate();
  const { draft, setSnsAccounts } = useSignup();
  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(draft.snsAccounts),
  });
  const values = useWatch({ control: methods.control });

  const enabledTypes = useMemo(
    () =>
      SNS_TYPES.filter((type) => values?.[TYPE_TO_KEY[type]]?.enabled === true),
    [values],
  );

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

  function next(formValues: Values) {
    const accounts = SNS_TYPES.filter(
      (type) => formValues[TYPE_TO_KEY[type]].enabled,
    ).map((type) => {
      const fields = formValues[TYPE_TO_KEY[type]];
      return {
        snsType: type,
        handle: fields.handle.trim(),
        followerCount: Number(fields.followerCount),
      };
    });
    setSnsAccounts(accounts);
    nav("/signup/bank");
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(next)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          SNSアカウント
        </h2>
        <p style={{ color: "#4b5563", fontSize: 12, marginBottom: 12 }}>
          登録するSNSを選択して情報を入力 (1つ以上必須)
        </p>
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
        <WizardFooter
          onBack={() => nav(-1)}
          onNext={methods.handleSubmit(next)}
          disabled={!isValid}
        />
      </form>
    </FormProvider>
  );
}
