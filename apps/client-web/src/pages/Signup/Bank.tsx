import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  INFLUENCER_TERMS_VERSION,
  InfluencerSignupRequestSchema,
  LineCompleteSignupRequestSchema,
} from "@jsure/shared";
import { Input } from "@/components/ui";
import { FormField } from "@/components/composites";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import { BankSelect } from "@/domains/me";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import {
  getLineSignupToken,
  setLineSignupTokenStorage,
  useSignup,
} from "../../context/SignupContext";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import {
  lineCompleteSignup,
  signup as signupApi,
} from "@/domains/auth";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

const schema = z
  .object({
    bank: z.object({ code: z.string(), name: z.string() }).nullable(),
    branchName: z
      .string()
      .refine((value) => value.trim().length > 0, "支店名は必須"),
    branchCode: z.string().regex(/^\d{3}$/, "支店コードは3桁"),
    accountNumber: z.string().regex(/^\d{6,8}$/, "口座番号は6~8桁"),
    accountHolderKana: z.string().regex(KANA_RE, "カナで入力してください"),
  })
  .superRefine((values, ctx) => {
    if (!values.bank) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "銀行を選択してください",
        path: ["bank"],
      });
    }
  });

type Values = z.infer<typeof schema>;

export function SignupBank() {
  const nav = useNavigate();
  const { draft, setBank, reset } = useSignup();
  const auth = useInfluencerAuth();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      bank: draft.bank.bankCode
        ? { code: draft.bank.bankCode, name: draft.bank.bankName }
        : null,
      branchName: draft.bank.branchName,
      branchCode: draft.bank.branchCode,
      accountNumber: draft.bank.accountNumber,
      accountHolderKana: draft.bank.accountHolderKana,
    },
  });

  async function submit(values: Values) {
    setServerError(null);
    if (!values.bank) return;
    const bank = values.bank;

    const payload = {
      email: draft.account.email,
      password: draft.account.password,
      name: draft.profile.name,
      nameKana: draft.profile.nameKana,
      phone: draft.profile.phone.replace(/[^\d]/g, ""),
      birthDate: draft.profile.birthDate,
      address: {
        postalCode: draft.profile.postalCode,
        prefecture: draft.profile.prefecture,
        city: draft.profile.city,
        addressLine1: draft.profile.addressLine1,
        addressLine2: draft.profile.addressLine2,
      },
      snsAccounts: draft.snsAccounts,
      bankAccount: {
        bankCode: bank.code,
        bankName: bank.name,
        branchName: values.branchName.trim(),
        branchCode: values.branchCode,
        accountNumber: values.accountNumber,
        accountHolderKana: values.accountHolderKana,
      },
      termsVersion: INFLUENCER_TERMS_VERSION,
      agreedItems: draft.agreedItems,
    };

    const lineToken = getLineSignupToken();
    const isLineFlow = !!lineToken;
    const parsed = isLineFlow
      ? LineCompleteSignupRequestSchema.safeParse({
          ...payload,
          signupToken: lineToken,
          password: payload.password || undefined,
        })
      : InfluencerSignupRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(
        parsed.error.issues[0]?.message ?? "入力内容を再度ご確認ください",
      );
      return;
    }

    setBank({
      bankCode: bank.code,
      bankName: bank.name,
      branchName: values.branchName.trim(),
      branchCode: values.branchCode,
      accountNumber: values.accountNumber,
      accountHolderKana: values.accountHolderKana,
    });
    setSubmitting(true);
    try {
      const res = isLineFlow
        ? await lineCompleteSignup(
            parsed.data as Parameters<typeof lineCompleteSignup>[0],
          )
        : await signupApi(parsed.data as Parameters<typeof signupApi>[0]);
      auth.setSession(res.accessToken, res.influencer);
      setLineSignupTokenStorage(null);
      reset();
      nav("/", { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ??
          "登録に失敗しました。しばらくしてから再度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(submit)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          振込先口座
        </h2>
        {serverError && <ErrorBanner message={serverError} />}

        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111",
            marginBottom: 6,
          }}
        >
          銀行
        </div>
        <Controller
          control={methods.control}
          name="bank"
          render={({ field, fieldState, formState }) => {
            const showError =
              (formState.isSubmitted || fieldState.isTouched) &&
              !!fieldState.error;
            const errorMessage = fieldState.error?.message;
            return (
              <>
                <BankSelect value={field.value} onChange={field.onChange} />
                {showError && (
                  <div
                    style={{
                      color: "#ef4444",
                      fontSize: 11,
                      marginTop: -8,
                      marginBottom: 8,
                    }}
                  >
                    {typeof errorMessage === "string"
                      ? errorMessage
                      : "銀行を選択してください"}
                  </div>
                )}
              </>
            );
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            columnGap: 12,
          }}
        >
          <FormField name="branchName" label="支店名">
            {(field) => (
              <Input
                id={field.id}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                placeholder="渋谷支店"
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <FormField name="branchCode" label="支店コード (3桁)">
            {(field) => (
              <Input
                id={field.id}
                value={field.value}
                onChange={(value) =>
                  field.onChange(value.replace(/[^\d]/g, "").slice(0, 3))
                }
                onBlur={field.onBlur}
                error={field.error}
                inputMode="numeric"
                maxLength={3}
                placeholder="123"
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
        </div>

        <FormField name="accountNumber" label="口座番号 (6~8桁)">
          {(field) => (
            <Input
              id={field.id}
              type="text"
              inputMode="numeric"
              value={field.value}
              onChange={(value) =>
                field.onChange(value.replace(/[^\d]/g, ""))
              }
              onBlur={field.onBlur}
              error={field.error}
              maxLength={8}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <FormField
          name="accountHolderKana"
          label="口座名義 (カナ)"
          hint="例: ヤマダ ハナコ"
        >
          {(field) => (
            <Input
              id={field.id}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={field.error}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <WizardFooter
          onBack={() => nav(-1)}
          onNext={methods.handleSubmit(submit)}
          nextLabel="登録完了"
          loading={submitting}
        />
      </form>
    </FormProvider>
  );
}
