import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LabeledInput } from "../../components/composites/LabeledInput";
import { WizardFooter } from "../../components/Signup/WizardFooter";
import { useSignup } from "../../context/SignupContext";
import {
  AddressFormFields,
  validateAddress,
  type AddressValues,
} from "../../components/Address/AddressFormFields";

const KANA_RE = /^[゠-ヿ　\sー]+$/;
const BIRTH_RE = /^\d{4}-\d{2}-\d{2}$/;
const TODAY_YMD = new Date().toISOString().slice(0, 10);

export function SignupProfile() {
  const nav = useNavigate();
  const { draft, setProfile } = useSignup();
  const [name, setName] = useState(draft.profile.name);
  const [nameKana, setNameKana] = useState(draft.profile.nameKana);
  const [phone, setPhone] = useState(draft.profile.phone);
  const [birthDate, setBirthDate] = useState(draft.profile.birthDate);
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
    birthDate:
      BIRTH_RE.test(birthDate) && birthDate <= TODAY_YMD
        ? undefined
        : "生年月日を入力してください",
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
      birthDate,
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
      <label className="li">
        <span className="li__label">生年月日</span>
        <input
          type="date"
          className={`li__input ${touched && errors.birthDate ? "li__input--error" : ""}`}
          value={birthDate}
          max={TODAY_YMD}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        {touched && errors.birthDate && (
          <span className="li__error">{errors.birthDate}</span>
        )}
      </label>

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
