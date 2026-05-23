import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  InfluencerBankAccountSchema,
  type InfluencerEntityType,
  type JpAccountType,
} from "@jsure/shared";
import { fetchMe } from "../../lib/api/auth";
import { upsertBankAccount } from "../../lib/api/me";
import { PageHeader } from "../../components/layout/PageHeader";
import { LabeledInput } from "../../components/form/LabeledInput";
import { RadioGroup } from "../../components/form/RadioGroup";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { BankSelect } from "../../components/Bank/BankSelect";
import { ErrorBanner } from "../../components/form/ErrorBanner";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function MeBank() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [ownerType, setOwnerType] = useState<InfluencerEntityType | null>(null);
  const [bank, setBank] = useState<{ code: string; name: string } | null>(null);
  const [branchName, setBranchName] = useState("");
  const [accountType, setAccountType] = useState<JpAccountType | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderKana, setAccountHolderKana] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.bankAccount) {
      setOwnerType(data.bankAccount.ownerType);
      setBank({
        code: data.bankAccount.bankCode,
        name: data.bankAccount.bankName,
      });
      setBranchName(data.bankAccount.branchName);
      setAccountType(data.bankAccount.accountType);
      setAccountHolderKana(data.bankAccount.accountHolderKana);
      // existing accountNumber not exposed; user must re-enter
    } else if (data?.entityType) {
      setOwnerType(data.entityType);
    }
  }, [data]);

  const errs = {
    ownerType: ownerType ? undefined : "種別を選択",
    bank: bank ? undefined : "銀行を選択",
    branchName: branchName.trim() ? undefined : "必須",
    accountType: accountType ? undefined : "口座種類を選択",
    accountNumber: /^\d{6,8}$/.test(accountNumber) ? undefined : "6~8桁",
    accountHolderKana: KANA_RE.test(accountHolderKana)
      ? undefined
      : "カナで入力",
  };
  const valid = !Object.values(errs).some((e) => e);

  const m = useMutation({
    mutationFn: () => {
      const payload = InfluencerBankAccountSchema.parse({
        ownerType: ownerType!,
        bankCode: bank!.code,
        bankName: bank!.name,
        branchName: branchName.trim(),
        accountType: accountType!,
        accountNumber,
        accountHolderKana,
      });
      return upsertBankAccount(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      nav("/me");
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "保存に失敗しました");
    },
  });

  function save() {
    setTouched(true);
    setError(null);
    if (!valid) return;
    m.mutate();
  }

  return (
    <div>
      <PageHeader showBack title="振込先口座" />
      <div style={{ padding: 16 }}>
        {error && <ErrorBanner message={error} />}
        {data?.bankAccount && (
          <div
            style={{
              background: "#fef3c7",
              color: "#92400e",
              padding: 10,
              borderRadius: 8,
              fontSize: 12,
              marginBottom: 14,
            }}
          >
            セキュリティのため口座番号は再入力してください
          </div>
        )}
        <RadioGroup<InfluencerEntityType>
          label="種別"
          value={ownerType}
          options={[
            { value: "INDIVIDUAL", label: "個人" },
            { value: "CORPORATE", label: "法人" },
          ]}
          onChange={setOwnerType}
          error={touched ? errs.ownerType : undefined}
        />
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
          銀行
        </div>
        <BankSelect value={bank} onChange={setBank} />
        <LabeledInput
          label="支店名"
          value={branchName}
          onChange={setBranchName}
          error={touched ? errs.branchName : undefined}
        />
        <RadioGroup<JpAccountType>
          label="口座種類"
          value={accountType}
          options={[
            { value: "FUTSU", label: "普通" },
            { value: "TOUZA", label: "当座" },
          ]}
          onChange={setAccountType}
          error={touched ? errs.accountType : undefined}
        />
        <LabeledInput
          label="口座番号"
          type="text"
          inputMode="numeric"
          value={accountNumber}
          onChange={(v) => setAccountNumber(v.replace(/[^\d]/g, ""))}
          maxLength={8}
          error={touched ? errs.accountNumber : undefined}
        />
        <LabeledInput
          label="口座名義 (カナ)"
          value={accountHolderKana}
          onChange={setAccountHolderKana}
          error={touched ? errs.accountHolderKana : undefined}
        />
        <PrimaryButton onClick={save} disabled={m.isPending}>
          {m.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </div>
  );
}
