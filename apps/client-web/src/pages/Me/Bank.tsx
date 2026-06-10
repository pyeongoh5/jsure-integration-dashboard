import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfluencerBankAccountSchema } from "@jsure/shared";
import { fetchMe } from "../../lib/api/auth";
import { upsertBankAccount } from "../../lib/api/me";
import { PageHeader } from "../../components/layout/PageHeader";
import { LabeledInput } from "../../components/form/LabeledInput";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { BankSelect } from "../../components/Bank/BankSelect";
import { ErrorBanner } from "../../components/form/ErrorBanner";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function MeBank() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const [bank, setBank] = useState<{ code: string; name: string } | null>(null);
  const [branchName, setBranchName] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderKana, setAccountHolderKana] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.bankAccount) {
      setBank({
        code: data.bankAccount.bankCode,
        name: data.bankAccount.bankName,
      });
      setBranchName(data.bankAccount.branchName);
      setBranchCode(data.bankAccount.branchCode);
      setAccountHolderKana(data.bankAccount.accountHolderKana);
      // existing accountNumber not exposed; user must re-enter
    }
  }, [data]);

  const errs = {
    bank: bank ? undefined : "銀行を選択",
    branchName: branchName.trim() ? undefined : "必須",
    branchCode: /^\d{3}$/.test(branchCode) ? undefined : "3桁",
    accountNumber: /^\d{6,8}$/.test(accountNumber) ? undefined : "6~8桁",
    accountHolderKana: KANA_RE.test(accountHolderKana)
      ? undefined
      : "カナで入力",
  };
  const valid = !Object.values(errs).some((e) => e);

  const m = useMutation({
    mutationFn: () => {
      const payload = InfluencerBankAccountSchema.parse({
        bankCode: bank!.code,
        bankName: bank!.name,
        branchName: branchName.trim(),
        branchCode,
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
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111", marginBottom: 6 }}>
          銀行
        </div>
        <BankSelect value={bank} onChange={setBank} />
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
            error={touched ? errs.branchName : undefined}
          />
          <LabeledInput
            label="支店コード (3桁)"
            value={branchCode}
            onChange={(v) =>
              setBranchCode(v.replace(/[^\d]/g, "").slice(0, 3))
            }
            error={touched ? errs.branchCode : undefined}
            inputMode="numeric"
            maxLength={3}
          />
        </div>
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
