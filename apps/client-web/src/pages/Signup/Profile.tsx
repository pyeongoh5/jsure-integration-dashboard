import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LabeledInput } from "../../components/form/LabeledInput";
import { WizardFooter } from "../../components/Signup/WizardFooter";
import { useSignup } from "../../context/SignupContext";
import {
  AddressFormFields,
  validateAddress,
  type AddressValues,
} from "../../components/Address/AddressFormFields";

const KANA_RE = /^[゠-ヿ　\sー]+$/;

export function SignupProfile() {
  const nav = useNavigate();
  const { draft, setProfile } = useSignup();
  const [name, setName] = useState(draft.profile.name);
  const [nameKana, setNameKana] = useState(draft.profile.nameKana);
  const [phone, setPhone] = useState(draft.profile.phone);
  const [address, setAddress] = useState<AddressValues>({
    postalCode: draft.profile.postalCode,
    prefecture: draft.profile.prefecture,
    city: draft.profile.city,
    addressLine1: draft.profile.addressLine1,
    addressLine2: draft.profile.addressLine2,
  });
  const [touched, setTouched] = useState(false);

  const addressErrors = validateAddress(address);
  const errors = {
    name: name.trim() ? undefined : "お名前は必須",
    nameKana: KANA_RE.test(nameKana) ? undefined : "カナで入力してください",
    phone: /^\d{10,15}$|^[\d-]{10,20}$/.test(phone)
      ? undefined
      : "電話番号は10~15桁",
    ...addressErrors,
  };
  const valid = !Object.values(errors).some((e) => e);

  function next() {
    setTouched(true);
    if (!valid) return;
    setProfile({
      name,
      nameKana,
      phone,
      ...address,
    });
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

      <AddressFormFields
        values={address}
        onChange={setAddress}
        touched={touched}
        errors={addressErrors}
      />

      <WizardFooter onBack={() => nav(-1)} onNext={next} />
    </div>
  );
}
