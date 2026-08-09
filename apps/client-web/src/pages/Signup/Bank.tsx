import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  INFLUENCER_TERMS_VERSION,
  InfluencerSignupRequestSchema,
  LineCompleteSignupRequestSchema,
} from "@jsure/shared";
import { t } from "@i18n";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import {
  BankFormFields,
  BankZodSchema,
  toBankAccountPayload,
  type BankValues,
} from "@/domains/me";
import { WizardFooter } from "@/components/composites/WizardFooter/WizardFooter";
import {
  getLineSignupToken,
  setLineSignupTokenStorage,
  useSignup,
} from "../../context/SignupContext";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import { lineCompleteSignup, signup as signupApi } from "@/domains/auth";
import styles from "./Bank.module.css";

export function SignupBank() {
  const nav = useNavigate();
  const { draft, setBank, reset } = useSignup();
  const auth = useInfluencerAuth();

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const methods = useForm<BankValues>({
    resolver: zodResolver(BankZodSchema),
    defaultValues: {
      country: draft.bank.bankCountry,
      bank: draft.bank.bankCode
        ? { code: draft.bank.bankCode, name: draft.bank.bankName }
        : null,
      branchName: draft.bank.branchName,
      branchCode: draft.bank.branchCode,
      accountNumber: draft.bank.accountNumber,
      accountHolder: draft.bank.accountHolder,
      invoiceRegistrationNumber: draft.bank.invoiceRegistrationNumber,
    },
  });

  async function submit(values: BankValues) {
    setServerError(null);
    if (!values.bank) return;

    const payload = {
      email: draft.account.email,
      password: draft.account.password,
      name: draft.profile.name,
      nameKana: draft.profile.nameKana,
      phone: draft.profile.phone.replace(/[^\d]/g, ""),
      birthDate: draft.profile.birthDate,
      address: {
        country: draft.profile.addressCountry,
        postalCode: draft.profile.postalCode,
        prefecture: draft.profile.prefecture,
        city: draft.profile.city,
        addressLine1: draft.profile.addressLine1,
        addressLine2: draft.profile.addressLine2,
      },
      snsAccounts: draft.snsAccounts,
      bankAccount: toBankAccountPayload(values),
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
      bankCountry: values.country,
      bankCode: values.bank.code,
      bankName: values.bank.name,
      branchName: values.branchName.trim(),
      branchCode: values.branchCode,
      accountNumber: values.accountNumber,
      accountHolder: values.accountHolder,
      invoiceRegistrationNumber: values.invoiceRegistrationNumber,
    });
    setSubmitting(true);
    try {
      const res = isLineFlow
        ? await lineCompleteSignup(
            parsed.data as Parameters<typeof lineCompleteSignup>[0],
          )
        : await signupApi(parsed.data as Parameters<typeof signupApi>[0]);
      auth.setSession(res.accessToken, res.influencer, res.refreshToken);
      setLineSignupTokenStorage(null);
      reset();
      nav("/", { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error?.response?.data?.message ?? t("pages.signup.bank.signupFailed"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(submit)}>
        <h2 className={styles.heading}>{t("pages.signup.bank.heading")}</h2>
        {serverError && <ErrorBanner message={serverError} />}

        <BankFormFields />

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
