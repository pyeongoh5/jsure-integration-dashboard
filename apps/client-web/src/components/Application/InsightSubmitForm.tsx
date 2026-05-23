import { useState } from "react";
import { LabeledInput } from "../form/LabeledInput";
import { PrimaryButton } from "../form/PrimaryButton";

interface Props {
  initial: { saves: number; reach: number; profileViews: number } | null;
  onSubmit: (v: { saves: number; reach: number; profileViews: number }) => Promise<void>;
  submitting: boolean;
}

export function InsightSubmitForm({ initial, onSubmit, submitting }: Props) {
  const [saves, setSaves] = useState(initial ? String(initial.saves) : "");
  const [reach, setReach] = useState(initial ? String(initial.reach) : "");
  const [profileViews, setProfileViews] = useState(
    initial ? String(initial.profileViews) : "",
  );
  const [touched, setTouched] = useState(false);

  const errs = {
    saves: /^\d+$/.test(saves) ? undefined : "数字を入力",
    reach: /^\d+$/.test(reach) ? undefined : "数字を入力",
    profileViews: /^\d+$/.test(profileViews) ? undefined : "数字を入力",
  };
  const valid = !Object.values(errs).some((e) => e);

  async function handle() {
    setTouched(true);
    if (!valid) return;
    await onSubmit({
      saves: Number(saves),
      reach: Number(reach),
      profileViews: Number(profileViews),
    });
  }

  return (
    <div>
      <div style={{
        background: "#fef3c7",
        padding: 10,
        borderRadius: 8,
        fontSize: 12,
        color: "#92400e",
        marginBottom: 14,
      }}>
        投稿から7日経過しました。インサイトをご提出ください。
      </div>
      <LabeledInput
        label="保存数"
        type="text"
        inputMode="numeric"
        value={saves}
        onChange={(v) => setSaves(v.replace(/[^\d]/g, ""))}
        error={touched ? errs.saves : undefined}
      />
      <LabeledInput
        label="リーチ数"
        type="text"
        inputMode="numeric"
        value={reach}
        onChange={(v) => setReach(v.replace(/[^\d]/g, ""))}
        error={touched ? errs.reach : undefined}
      />
      <LabeledInput
        label="プロフィール表示数"
        type="text"
        inputMode="numeric"
        value={profileViews}
        onChange={(v) => setProfileViews(v.replace(/[^\d]/g, ""))}
        error={touched ? errs.profileViews : undefined}
      />
      <PrimaryButton onClick={handle} disabled={submitting}>
        {submitting ? "送信中…" : "インサイトを提出"}
      </PrimaryButton>
    </div>
  );
}
