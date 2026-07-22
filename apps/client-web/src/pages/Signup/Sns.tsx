import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ENABLED_SNS_TYPES,
  normalizeSnsHandle,
  type SnsAccountSubType,
} from "@jsure/shared";
import { SnsAccountCard } from "@/domains/auth";
import { t, type TranslationKey } from "@i18n";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import { useSignup } from "../../context/SignupContext";

const SNS_TYPES = ENABLED_SNS_TYPES;

const fieldsSchema = z.object({
  enabled: z.boolean(),
  handle: z.string(),
  followerCount: z.string(),
});

/** 핸들 ID 최대 길이 — 공유 스키마 InfluencerSnsAccountInputSchema.handle.max(64) 와 동일. */
const HANDLE_MAX = 64;

/**
 * SNS 핸들 검증 결과. 공유 스키마와 동일 기준(normalizeSnsHandle → min(1).max(64))으로 판정하고,
 * URL 붙여넣기(슬래시 포함)를 별도 안내한다. superRefine·isValid 가 이 헬퍼를 공유해 로직 일치를 보장한다.
 */
function checkHandle(raw: string): "ok" | "empty" | "url" | "tooLong" {
  const normalized = normalizeSnsHandle(raw);
  if (normalized.length === 0) return "empty";
  if (normalized.includes("/")) return "url";
  if (normalized.length > HANDLE_MAX) return "tooLong";
  return "ok";
}

const HANDLE_ERROR_KEY: Record<
  Exclude<ReturnType<typeof checkHandle>, "ok">,
  TranslationKey
> = {
  empty: "pages.signup.sns.handleRequired",
  url: "pages.signup.sns.handleUrl",
  tooLong: "pages.signup.sns.handleTooLong",
};

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
        message: t("pages.signup.sns.atLeastOne"),
        path: ["instagram"],
      });
      return;
    }
    for (const key of enabled) {
      const fields = values[key];
      const handleResult = checkHandle(fields.handle);
      if (handleResult !== "ok") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t(HANDLE_ERROR_KEY[handleResult]),
          path: [key, "handle"],
        });
      }
      if (!/^\d+$/.test(fields.followerCount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("pages.signup.sns.followerCountInvalid"),
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
        checkHandle(fields.handle) === "ok" &&
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
    // 블러(또는 제출)로 에러가 한 번 표시된 뒤에는 입력 즉시 재검증해 에러를 갱신/해제한다.
    const hasError = Boolean(methods.formState.errors[key]);
    methods.setValue(
      key,
      { ...current, [field]: value },
      {
        shouldDirty: true,
        shouldValidate: methods.formState.isSubmitted || hasError,
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
          {t("pages.signup.sns.heading")}
        </h2>
        <p style={{ color: "#4b5563", fontSize: 12, marginBottom: 12 }}>
          {t("pages.signup.sns.hint")}
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
              handleError={
                methods.formState.errors[TYPE_TO_KEY[type]]?.handle?.message
              }
              onHandleBlur={() => void methods.trigger(TYPE_TO_KEY[type])}
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
