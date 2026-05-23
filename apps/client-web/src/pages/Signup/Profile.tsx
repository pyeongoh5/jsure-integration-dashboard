import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { InfluencerEntityType } from "@jsure/shared";
import { LabeledInput } from "../../components/form/LabeledInput";
import { RadioGroup } from "../../components/form/RadioGroup";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { useSignup } from "../../context/SignupContext";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function SignupProfile() {
  const nav = useNavigate();
  const { draft, setProfile } = useSignup();
  const [name, setName] = useState(draft.profile.name);
  const [nameKana, setNameKana] = useState(draft.profile.nameKana);
  const [phone, setPhone] = useState(draft.profile.phone);
  const [entityType, setEntityType] = useState<InfluencerEntityType | null>(
    draft.profile.entityType,
  );
  const [touched, setTouched] = useState(false);

  const errors = {
    name: name.trim() ? undefined : "お名前は必須",
    nameKana: KANA_RE.test(nameKana) ? undefined : "カナで入力してください",
    phone: /^\d{10,15}$|^[\d-]{10,20}$/.test(phone)
      ? undefined
      : "電話番号は10~15桁",
    entityType: entityType ? undefined : "種別を選択してください",
  };
  const valid = !Object.values(errors).some((e) => e);

  function next() {
    setTouched(true);
    if (!valid || !entityType) return;
    setProfile({ name, nameKana, phone, entityType });
    nav("/signup/sns");
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        プロフィール
      </h2>
      <LabeledInput
        label="お名前"
        value={name}
        onChange={setName}
        error={touched ? errors.name : undefined}
      />
      <LabeledInput
        label="お名前 (カナ)"
        value={nameKana}
        onChange={setNameKana}
        error={touched ? errors.nameKana : undefined}
        hint="例: ヤマダ ハナコ"
      />
      <LabeledInput
        label="電話番号"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={setPhone}
        error={touched ? errors.phone : undefined}
        placeholder="09012345678"
      />
      <RadioGroup<InfluencerEntityType>
        label="種別"
        value={entityType}
        options={[
          { value: "INDIVIDUAL", label: "個人" },
          { value: "CORPORATE", label: "法人" },
        ]}
        onChange={setEntityType}
        error={touched ? errors.entityType : undefined}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <PrimaryButton variant="ghost" onClick={() => nav(-1)}>
          戻る
        </PrimaryButton>
        <PrimaryButton onClick={next}>次へ</PrimaryButton>
      </div>
    </div>
  );
}
