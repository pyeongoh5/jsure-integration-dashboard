import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  INFLUENCER_TERMS_VERSION,
  InfluencerSignupRequestSchema,
  LineCompleteSignupRequestSchema,
} from "@jsure/shared";
import { LabeledInput } from "../../components/form/LabeledInput";
import { ErrorBanner } from "../../components/form/ErrorBanner";
import { BankSelect } from "../../components/Bank/BankSelect";
import { WizardFooter } from "../../components/Signup/WizardFooter";
import {
  getLineSignupToken,
  setLineSignupTokenStorage,
  useSignup,
} from "../../context/SignupContext";
import { useInfluencerAuth } from "../../context/InfluencerAuthContext";
import {
  lineCompleteSignup,
  signup as signupApi,
} from "../../lib/api/auth";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function SignupBank() {
  const nav = useNavigate();
  const { draft, setBank, reset } = useSignup();
  const auth = useInfluencerAuth();

  const [bank, setBankField] = useState<{ code: string; name: string } | null>(
    draft.bank.bankCode
      ? { code: draft.bank.bankCode, name: draft.bank.bankName }
      : null,
  );
  const [branchName, setBranchName] = useState(draft.bank.branchName);
  const [branchCode, setBranchCode] = useState(draft.bank.branchCode);
  const [accountNumber, setAccountNumber] = useState(draft.bank.accountNumber);
  const [accountHolderKana, setAccountHolderKana] = useState(
    draft.bank.accountHolderKana,
  );
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const errors = {
    bank: bank ? undefined : "銀行を選択してください",
    branchName: branchName.trim() ? undefined : "支店名は必須",
    branchCode: /^\d{3}$/.test(branchCode) ? undefined : "支店コードは3桁",
    accountNumber: /^\d{6,8}$/.test(accountNumber)
      ? undefined
      : "口座番号は6~8桁",
    accountHolderKana: KANA_RE.test(accountHolderKana)
      ? undefined
      : "カナで入力してください",
  };
  const valid = !Object.values(errors).some((e) => e);

  async function submit() {
    setTouched(true);
    setServerError(null);
    if (!valid || !bank) return;

    const payload = {
      email: draft.account.email,
      password: draft.account.password,
      name: draft.profile.name,
      nameKana: draft.profile.nameKana,
      phone: draft.profile.phone.replace(/[^\d]/g, ""),
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
        branchName: branchName.trim(),
        branchCode,
        accountNumber,
        accountHolderKana,
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
      branchName: branchName.trim(),
      branchCode,
      accountNumber,
      accountHolderKana,
    });
    setSubmitting(true);
    try {
      const res = isLineFlow
        ? await lineCompleteSignup(
            parsed.data as Parameters<typeof lineCompleteSignup>[0],
          )
        : await signupApi(
            parsed.data as Parameters<typeof signupApi>[0],
          );
      auth.setSession(res.accessToken, res.influencer);
      setLineSignupTokenStorage(null);
      reset();
      nav("/", { replace: true });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setServerError(
        e?.response?.data?.message ??
          "登録に失敗しました。しばらくしてから再度お試しください。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        振込先口座
      </h2>
      {serverError && <ErrorBanner message={serverError} />}

      <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
        銀行
      </div>
      <BankSelect value={bank} onChange={setBankField} />
      {touched && errors.bank && (
        <div style={{ color: "#ef4444", fontSize: 11, marginTop: -8, marginBottom: 8 }}>
          {errors.bank}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: 12,
        }}
      >
        <LabeledInput
          label="支店名"
          value={branchName}
          onChange={setBranchName}
          error={touched ? errors.branchName : undefined}
          placeholder="渋谷支店"
        />
        <LabeledInput
          label="支店コード (3桁)"
          value={branchCode}
          onChange={(v) => setBranchCode(v.replace(/[^\d]/g, "").slice(0, 3))}
          error={touched ? errors.branchCode : undefined}
          inputMode="numeric"
          maxLength={3}
          placeholder="123"
        />
      </div>

      <LabeledInput
        label="口座番号 (6~8桁)"
        type="text"
        inputMode="numeric"
        value={accountNumber}
        onChange={(v) => setAccountNumber(v.replace(/[^\d]/g, ""))}
        error={touched ? errors.accountNumber : undefined}
        maxLength={8}
      />

      <LabeledInput
        label="口座名義 (カナ)"
        value={accountHolderKana}
        onChange={setAccountHolderKana}
        error={touched ? errors.accountHolderKana : undefined}
        hint="例: ヤマダ ハナコ"
      />

      <WizardFooter
        onBack={() => nav(-1)}
        onNext={submit}
        nextLabel="登録完了"
        loading={submitting}
      />
    </div>
  );
}
