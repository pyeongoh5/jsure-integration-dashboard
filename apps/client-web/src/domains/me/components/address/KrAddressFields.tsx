import { useEffect, useState } from "react";
import { useFormContext, useController } from "react-hook-form";
import { LabeledInput } from "@/components/composites/LabeledInput";
import labeledInputStyles from "@/components/composites/LabeledInput.module.css";
import { loadDaumPostcode, type KrAddressResult } from "@/lib/daumPostcode";
import { t } from "@i18n";
import { AddressTextFields } from "./AddressTextFields";
import { KrManualAddressFields } from "./KrManualAddressFields";
import { PostcodeSearchDialog } from "./PostcodeSearchDialog";
import styles from "./Address.module.css";

type AddressFieldValues = Record<string, unknown>;

/**
 * 한국 주소 입력. 다음 우편번호 검색으로 우편번호·시도·시군구·도로명을 한 번에 채우고
 * 사용자는 상세 주소만 입력한다.
 *
 * 스크립트 로드가 실패하면 주소를 아예 넣을 수 없게 되므로 수동 입력 폼으로 되돌린다.
 * 회원가입이 막히는 것보다는 직접 입력하는 편이 낫다.
 */
export function KrAddressFields({
  fieldName,
}: {
  fieldName: (key: string) => string;
}) {
  const methods = useFormContext<AddressFieldValues>();
  const [scriptState, setScriptState] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDaumPostcode()
      .then(() => {
        if (!cancelled) setScriptState("ready");
      })
      .catch(() => {
        if (!cancelled) setScriptState("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const postal = useController({
    name: fieldName("postalCode"),
    control: methods.control,
  });
  const prefecture = useController({
    name: fieldName("prefecture"),
    control: methods.control,
  });
  const city = useController({
    name: fieldName("city"),
    control: methods.control,
  });
  const addressLine1 = useController({
    name: fieldName("addressLine1"),
    control: methods.control,
  });

  function applyResult(result: KrAddressResult) {
    const applied: Record<string, string> = {
      postalCode: result.postalCode,
      prefecture: result.prefecture,
      city: result.city,
      addressLine1: result.addressLine1,
    };
    for (const [key, value] of Object.entries(applied)) {
      methods.setValue(fieldName(key), value, {
        shouldValidate: true,
        shouldTouch: true,
      });
    }
    setSearchOpen(false);
  }

  if (scriptState === "failed") {
    return <KrManualAddressFields fieldName={fieldName} />;
  }

  const searchedAddress = [
    prefecture.field.value,
    city.field.value,
    addressLine1.field.value,
  ]
    .filter((part): part is string => typeof part === "string" && part !== "")
    .join(" ");

  // 검색으로만 채우는 값이라 개별 필드가 아닌 묶음으로 오류를 보여준다.
  const addressError =
    (methods.formState.isSubmitted || postal.fieldState.isTouched) &&
    (postal.fieldState.error ||
      prefecture.fieldState.error ||
      city.fieldState.error ||
      addressLine1.fieldState.error)
      ? t("me.addressKr.searchRequired")
      : undefined;

  return (
    <>
      <div className={styles.searchRow}>
        <LabeledInput
          label={t("me.addressKr.postalCodeLabel")}
          value={
            typeof postal.field.value === "string" ? postal.field.value : ""
          }
          onChange={() => {
            /* 검색으로만 채운다 */
          }}
          placeholder={t("me.addressKr.postalCodePlaceholder")}
          readOnly
        />
        <button
          type="button"
          className={styles.searchButton}
          onClick={() => setSearchOpen(true)}
          disabled={scriptState === "loading"}
        >
          {scriptState === "loading"
            ? t("me.addressKr.searchLoading")
            : t("me.addressKr.searchButton")}
        </button>
      </div>

      <label className={labeledInputStyles.field}>
        <span className={labeledInputStyles.label}>
          {t("me.addressKr.addressLabel")}
        </span>
        <input
          className={[
            labeledInputStyles.input,
            addressError && labeledInputStyles.error,
          ]
            .filter(Boolean)
            .join(" ")}
          type="text"
          value={searchedAddress}
          placeholder={t("me.addressKr.addressPlaceholder")}
          readOnly
        />
        {addressError && (
          <span className={labeledInputStyles.errorText}>{addressError}</span>
        )}
      </label>

      <AddressTextFields
        addressLine2={{
          name: fieldName("addressLine2"),
          label: t("me.addressKr.addressLine2Label"),
          placeholder: t("me.addressKr.addressLine2Placeholder"),
        }}
      />

      {searchOpen && (
        <PostcodeSearchDialog
          onSelect={applyResult}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}
