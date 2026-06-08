import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { JP_PREFECTURES } from "@jsure/shared";
import { LabeledInput } from "../../components/form/LabeledInput";
import { WizardFooter } from "../../components/Signup/WizardFooter";
import { useSignup } from "../../context/SignupContext";
import { lookupPostalCode } from "../../lib/zipcloud";

const KANA_RE = /^[゠-ヿ　\sー]+$/;
const POSTAL_RE = /^\d{3}-?\d{4}$/;

function formatPostalCode(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function SignupProfile() {
  const nav = useNavigate();
  const { draft, setProfile } = useSignup();
  const [name, setName] = useState(draft.profile.name);
  const [nameKana, setNameKana] = useState(draft.profile.nameKana);
  const [phone, setPhone] = useState(draft.profile.phone);
  const [postalCode, setPostalCode] = useState(draft.profile.postalCode);
  const [prefecture, setPrefecture] = useState(draft.profile.prefecture);
  const [city, setCity] = useState(draft.profile.city);
  const [addressLine1, setAddressLine1] = useState(draft.profile.addressLine1);
  const [addressLine2, setAddressLine2] = useState(draft.profile.addressLine2);
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "notFound" | "error"
  >("idle");
  const [touched, setTouched] = useState(false);

  const errors = {
    name: name.trim() ? undefined : "お名前は必須",
    nameKana: KANA_RE.test(nameKana) ? undefined : "カナで入力してください",
    phone: /^\d{10,15}$|^[\d-]{10,20}$/.test(phone)
      ? undefined
      : "電話番号は10~15桁",
    postalCode: POSTAL_RE.test(postalCode) ? undefined : "郵便番号は7桁",
    prefecture: (JP_PREFECTURES as readonly string[]).includes(prefecture)
      ? undefined
      : "都道府県を選択してください",
    city: city.trim() ? undefined : "市区町村は必須",
    addressLine1: addressLine1.trim() ? undefined : "番地は必須",
  };
  const valid = !Object.values(errors).some((e) => e);

  async function handlePostalChange(raw: string) {
    const formatted = formatPostalCode(raw);
    setPostalCode(formatted);
    if (!POSTAL_RE.test(formatted)) {
      setLookupState("idle");
      return;
    }
    setLookupState("loading");
    try {
      const result = await lookupPostalCode(formatted);
      if (!result) {
        setLookupState("notFound");
        return;
      }
      setPrefecture(result.prefecture);
      setCity(`${result.city}${result.town}`);
      setLookupState("idle");
    } catch {
      setLookupState("error");
    }
  }

  function next() {
    setTouched(true);
    if (!valid) return;
    setProfile({
      name,
      nameKana,
      phone,
      postalCode,
      prefecture,
      city,
      addressLine1,
      addressLine2,
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
      <div
        style={{
          marginTop: 20,
          marginBottom: 10,
          fontSize: 13,
          fontWeight: 600,
          color: "#111",
        }}
      >
        住所
      </div>

      <LabeledInput
        label="郵便番号"
        value={postalCode}
        onChange={handlePostalChange}
        error={touched ? errors.postalCode : undefined}
        hint={
          lookupState === "loading"
            ? "住所を検索中…"
            : lookupState === "notFound"
              ? "該当する住所が見つかりませんでした"
              : lookupState === "error"
                ? "住所検索に失敗しました。手動で入力してください"
                : "例: 150-0001 (入力すると自動補完されます)"
        }
        placeholder="1500001"
        inputMode="numeric"
        maxLength={8}
      />

      <label className="li">
        <span className="li__label">都道府県</span>
        <select
          className={`li__input ${touched && errors.prefecture ? "li__input--error" : ""}`}
          value={prefecture}
          onChange={(e) => setPrefecture(e.target.value)}
        >
          <option value="">選択してください</option>
          {JP_PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {touched && errors.prefecture && (
          <span className="li__error">{errors.prefecture}</span>
        )}
      </label>

      <LabeledInput
        label="市区町村"
        value={city}
        onChange={setCity}
        error={touched ? errors.city : undefined}
        placeholder="渋谷区神宮前"
      />
      <LabeledInput
        label="番地"
        value={addressLine1}
        onChange={setAddressLine1}
        error={touched ? errors.addressLine1 : undefined}
        placeholder="1-2-3"
      />
      <LabeledInput
        label="建物名・部屋番号 (任意)"
        value={addressLine2}
        onChange={setAddressLine2}
        placeholder="ABCビル 502号室"
      />

      <WizardFooter onBack={() => nav(-1)} onNext={next} />
    </div>
  );
}
