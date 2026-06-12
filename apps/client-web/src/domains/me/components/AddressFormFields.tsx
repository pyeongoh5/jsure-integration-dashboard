import { useState } from "react";
import { JP_PREFECTURES } from "@jsure/shared";
import { LabeledInput } from "@/components/composites/LabeledInput";
import { lookupPostalCode } from "@/lib/zipcloud";

const POSTAL_RE = /^\d{3}-?\d{4}$/;

function formatPostalCode(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "").slice(0, 7);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export type AddressValues = {
  postalCode: string;
  prefecture: string;
  city: string;
  addressLine1: string;
  addressLine2: string;
};

export type AddressErrors = Partial<
  Record<keyof AddressValues, string | undefined>
>;

type Props = {
  values: AddressValues;
  onChange: (next: AddressValues) => void;
  touched: boolean;
  errors: AddressErrors;
  /** "住所" 헤더를 컴포넌트 안에 넣을지 (default true) */
  showHeading?: boolean;
};

/**
 * 회원가입 / 마이페이지 양쪽에서 공유되는 주소 입력 필드.
 * - 郵便番号 입력 시 zipcloud 로 都道府県/市区町村 자동 보완
 */
export function AddressFormFields({
  values,
  onChange,
  touched,
  errors,
  showHeading = true,
}: Props) {
  const [lookupState, setLookupState] = useState<
    "idle" | "loading" | "notFound" | "error"
  >("idle");

  const patch = (next: Partial<AddressValues>) =>
    onChange({ ...values, ...next });

  async function handlePostalChange(raw: string) {
    const formatted = formatPostalCode(raw);
    patch({ postalCode: formatted });
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
      patch({
        postalCode: formatted,
        prefecture: result.prefecture,
        city: `${result.city}${result.town}`,
      });
      setLookupState("idle");
    } catch {
      setLookupState("error");
    }
  }

  return (
    <div>
      {showHeading && (
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
      )}

      <LabeledInput
        label="郵便番号"
        value={values.postalCode}
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
          value={values.prefecture}
          onChange={(e) => patch({ prefecture: e.target.value })}
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
        value={values.city}
        onChange={(v) => patch({ city: v })}
        error={touched ? errors.city : undefined}
        placeholder="渋谷区神宮前"
      />
      <LabeledInput
        label="番地"
        value={values.addressLine1}
        onChange={(v) => patch({ addressLine1: v })}
        error={touched ? errors.addressLine1 : undefined}
        placeholder="1-2-3"
      />
      <LabeledInput
        label="建物名・部屋番号 (任意)"
        value={values.addressLine2}
        onChange={(v) => patch({ addressLine2: v })}
        placeholder="ABCビル 502号室"
      />
    </div>
  );
}

export function validateAddress(values: AddressValues): AddressErrors {
  return {
    postalCode: POSTAL_RE.test(values.postalCode) ? undefined : "郵便番号は7桁",
    prefecture: (JP_PREFECTURES as readonly string[]).includes(values.prefecture)
      ? undefined
      : "都道府県を選択してください",
    city: values.city.trim() ? undefined : "市区町村は必須",
    addressLine1: values.addressLine1.trim() ? undefined : "番地は必須",
  };
}
