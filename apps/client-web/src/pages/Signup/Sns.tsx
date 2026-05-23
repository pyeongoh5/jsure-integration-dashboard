import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SnsTypeSchema, type SnsType } from "@jsure/shared";
import { SnsAccountCard } from "../../components/Signup/SnsAccountCard";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { useSignup } from "../../context/SignupContext";

const SNS_TYPES = SnsTypeSchema.options;

interface FieldsByType {
  enabled: boolean;
  handle: string;
  followerCount: string;
}

function buildInitial(
  existing: { snsType: SnsType; handle: string; followerCount: number }[],
): Record<SnsType, FieldsByType> {
  const map = Object.fromEntries(
    SNS_TYPES.map((t) => [
      t,
      { enabled: false, handle: "", followerCount: "" } as FieldsByType,
    ]),
  ) as Record<SnsType, FieldsByType>;
  for (const e of existing) {
    map[e.snsType] = {
      enabled: true,
      handle: e.handle,
      followerCount: String(e.followerCount),
    };
  }
  return map;
}

export function SignupSns() {
  const nav = useNavigate();
  const { draft, setSnsAccounts } = useSignup();
  const [state, setState] = useState(() => buildInitial(draft.snsAccounts));

  const enabledTypes = useMemo(
    () => SNS_TYPES.filter((t) => state[t].enabled),
    [state],
  );

  const isValid =
    enabledTypes.length > 0 &&
    enabledTypes.every((t) => {
      const f = state[t];
      return f.handle.trim().length > 0 && /^\d+$/.test(f.followerCount);
    });

  function toggle(t: SnsType) {
    setState((prev) => ({
      ...prev,
      [t]: { ...prev[t], enabled: !prev[t].enabled },
    }));
  }
  function change(t: SnsType, field: "handle" | "followerCount", v: string) {
    setState((prev) => ({ ...prev, [t]: { ...prev[t], [field]: v } }));
  }

  function next() {
    if (!isValid) return;
    setSnsAccounts(
      enabledTypes.map((t) => ({
        snsType: t,
        handle: state[t].handle.trim(),
        followerCount: Number(state[t].followerCount),
      })),
    );
    nav("/signup/bank");
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        SNSアカウント
      </h2>
      <p style={{ color: "#4b5563", fontSize: 12, marginBottom: 12 }}>
        登録するSNSを選択して情報を入力 (1つ以上必須)
      </p>
      {SNS_TYPES.map((t) => (
        <SnsAccountCard
          key={t}
          snsType={t}
          enabled={state[t].enabled}
          handle={state[t].handle}
          followerCount={state[t].followerCount}
          onToggle={() => toggle(t)}
          onChange={(field, v) => change(t, field, v)}
        />
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <PrimaryButton variant="ghost" onClick={() => nav(-1)}>
          戻る
        </PrimaryButton>
        <PrimaryButton onClick={next} disabled={!isValid}>
          次へ
        </PrimaryButton>
      </div>
    </div>
  );
}
