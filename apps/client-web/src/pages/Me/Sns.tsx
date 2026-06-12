import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
import { fetchMe } from "../../lib/api/auth";
import { deleteSnsAccount, upsertSnsAccount } from "../../lib/api/me";
import { PageHeader } from "../../components/composites/PageHeader";
import { SnsAccountCard } from "../../components/Signup/SnsAccountCard";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { ErrorBanner } from "../../components/composites/ErrorBanner";

const SNS_TYPES = SnsTypeSchema.options;
type Fields = { enabled: boolean; handle: string; followerCount: string };

export function MeSns() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const [state, setState] = useState<Record<SnsType, Fields>>(() =>
    Object.fromEntries(
      SNS_TYPES.map((t) => [t, { enabled: false, handle: "", followerCount: "" }]),
    ) as Record<SnsType, Fields>,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const next: Record<SnsType, Fields> = Object.fromEntries(
      SNS_TYPES.map((t) => [t, { enabled: false, handle: "", followerCount: "" }]),
    ) as Record<SnsType, Fields>;
    for (const sns of data.snsAccounts) {
      next[sns.snsType] = {
        enabled: true,
        handle: sns.handle,
        followerCount: String(sns.followerCount),
      };
    }
    setState(next);
  }, [data]);

  const enabledTypes = SNS_TYPES.filter((t) => state[t].enabled);
  const existing = new Set(data?.snsAccounts.map((s) => s.snsType) ?? []);

  const upsert = useMutation({
    mutationFn: (snsType: SnsType) =>
      upsertSnsAccount({
        snsType,
        handle: state[snsType].handle.trim(),
        followerCount: Number(state[snsType].followerCount),
      }),
  });
  const remove = useMutation({
    mutationFn: (snsType: SnsType) => deleteSnsAccount(snsType),
  });

  const valid =
    enabledTypes.length > 0 &&
    enabledTypes.every(
      (t) =>
        state[t].handle.trim().length > 0 &&
        /^\d+$/.test(state[t].followerCount),
    );

  async function save() {
    setError(null);
    try {
      for (const t of enabledTypes) {
        await upsert.mutateAsync(t);
      }
      for (const t of SNS_TYPES) {
        if (!state[t].enabled && existing.has(t)) {
          await remove.mutateAsync(t);
        }
      }
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "保存に失敗しました");
    }
  }

  function toggle(t: SnsType) {
    setState((p) => ({ ...p, [t]: { ...p[t], enabled: !p[t].enabled } }));
  }
  function change(t: SnsType, f: "handle" | "followerCount", v: string) {
    setState((p) => ({ ...p, [t]: { ...p[t], [f]: v } }));
  }

  return (
    <div>
      <PageHeader showBack title="SNSアカウント" />
      <div style={{ padding: 16 }}>
        {error && <ErrorBanner message={error} />}
        {SNS_TYPES.map((t) => (
          <SnsAccountCard
            key={t}
            snsType={t}
            enabled={state[t].enabled}
            handle={state[t].handle}
            followerCount={state[t].followerCount}
            onToggle={() => toggle(t)}
            onChange={(f, v) => change(t, f, v)}
          />
        ))}
        <PrimaryButton
          onClick={save}
          disabled={!valid || upsert.isPending || remove.isPending}
        >
          {upsert.isPending || remove.isPending ? "保存中…" : "保存"}
        </PrimaryButton>
      </div>
    </div>
  );
}
