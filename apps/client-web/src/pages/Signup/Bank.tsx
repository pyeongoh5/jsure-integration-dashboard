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
import { t } from "@i18n";
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
      .refine((value) => value.trim().length > 0, t("pages.signup.bank.branchNameRequired")),
    branchCode: z.string().regex(/^\d{3}$/, t("pages.signup.bank.branchCodeInvalid")),
    accountNumber: z.string().regex(/^\d{7}$/, t("pages.signup.bank.accountNumberInvalid")),
    accountHolderKana: z.string().regex(KANA_RE, t("pages.signup.bank.kanaInvalid")),
    invoiceRegistrationNumber: z
      .string()
      .regex(/^T\d{13}$/, t("pages.signup.bank.invoiceNumberInvalid"))
      .or(z.literal("")), // new
  })
  .superRefine((values, ctx) => {
    if (!values.bank) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("pages.signup.bank.bankRequired"),
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
      invoiceRegistrationNumber: draft.bank.invoiceRegistrationNumber, // new
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
        invoiceRegistrationNumber: values.invoiceRegistrationNumber || null, // new
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
        parsed.error.issues[0]?.message ?? t("pages.signup.bank.reviewInputs"),
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
      invoiceRegistrationNumber: values.invoiceRegistrationNumber, // new
    });
    setSubmitting(true);
    try {
      const res = isLineFlow
        ? await lineCompleteSignup(
            parsed.data as Parameters<typeof lineCompleteSignup>[0],
          )
        : await signupApi(parsed.data as Parameters<typeof signupApi>[0]);
      auth.setSession(res.accessToken, res.influencer, res.refreshToken); // new
      setLineSignupTokenStorage(null);
      reset();
      nav("/", { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ??
          t("pages.signup.bank.signupFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(submit)}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
          {t("pages.signup.bank.heading")}
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
          {t("pages.signup.bank.bankLabel")}
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
                      : t("pages.signup.bank.bankRequired")}
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
          <FormField name="branchName" label={t("pages.signup.bank.branchNameLabel")}>
            {(field) => (
              <Input
                id={field.id}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={field.error}
                placeholder={t("pages.signup.bank.branchNamePlaceholder")}
                aria-invalid={field["aria-invalid"]}
              />
            )}
          </FormField>
          <FormField name="branchCode" label={t("pages.signup.bank.branchCodeLabel")}>
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

        <FormField name="accountNumber" label={t("pages.signup.bank.accountNumberLabel")}>
          {(field) => (
            <Input
              id={field.id}
              type="text"
              inputMode="numeric"
              value={field.value}
              onChange={(value) =>
                field.onChange(value.replace(/[^\d]/g, "").slice(0, 7))
              }
              onBlur={field.onBlur}
              error={field.error}
              maxLength={7}
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <FormField
          name="accountHolderKana"
          label={t("pages.signup.bank.accountHolderKanaLabel")}
          hint={t("pages.signup.bank.kanaHint")}
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

        <FormField
          name="invoiceRegistrationNumber"
          label={t("pages.signup.bank.invoiceNumberLabel")}
          hint={t("pages.signup.bank.invoiceNumberHint")}
        >
          {(field) => (
            <Input
              id={field.id}
              value={field.value}
              onChange={(value) =>
                field.onChange(
                  value.toUpperCase().replace(/[^T\d]/g, "").slice(0, 14),
                )
              }
              onBlur={field.onBlur}
              error={field.error}
              maxLength={14}
              placeholder="T1234567890123"
              aria-invalid={field["aria-invalid"]}
            />
          )}
        </FormField>

        <WizardFooter
          onBack={() => nav(-1)}
          onNext={methods.handleSubmit(submit)}
          nextLabel={t("pages.signup.bank.submit")}
          loading={submitting}
        />
      </form>
    </FormProvider>
  );
}
