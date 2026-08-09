import { FormField } from "@/components/composites";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";

type FieldSpec = {
  name: string;
  label: string;
  placeholder: string;
};

/**
 * 시·군·구 / 도로명(번지) / 상세주소 입력. 마크업이 국가별로 같고 라벨과
 * 플레이스홀더만 달라 국가별 컴포넌트가 이 셋을 채워 넘긴다.
 */
export function AddressTextFields({
  city,
  addressLine1,
  addressLine2,
}: {
  /** 검색으로 채우는 화면에서는 생략한다. */
  city?: FieldSpec;
  addressLine1?: FieldSpec;
  /** 상세주소는 선택 입력이라 오류 표시가 없다. */
  addressLine2: FieldSpec;
}) {
  return (
    <>
      {city && (
      <FormField name={city.name} label={city.label}>
        {(field) => (
          <input
            id={field.id}
            className={[
              labeledInputStyles.input,
              field.error && labeledInputStyles.error,
            ]
              .filter(Boolean)
              .join(" ")}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder={city.placeholder}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
      )}

      {addressLine1 && (
      <FormField name={addressLine1.name} label={addressLine1.label}>
        {(field) => (
          <input
            id={field.id}
            className={[
              labeledInputStyles.input,
              field.error && labeledInputStyles.error,
            ]
              .filter(Boolean)
              .join(" ")}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder={addressLine1.placeholder}
            aria-invalid={field["aria-invalid"]}
          />
        )}
      </FormField>
      )}

      <FormField name={addressLine2.name} label={addressLine2.label}>
        {(field) => (
          <input
            id={field.id}
            className={labeledInputStyles.input}
            type="text"
            value={typeof field.value === "string" ? field.value : ""}
            onChange={(event) => field.onChange(event.target.value)}
            onBlur={field.onBlur}
            placeholder={addressLine2.placeholder}
          />
        )}
      </FormField>
    </>
  );
}
