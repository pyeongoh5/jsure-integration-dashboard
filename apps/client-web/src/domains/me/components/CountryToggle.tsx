import { useState } from "react";
import type { AddressCountry } from "@jsure/shared";
import { t } from "@i18n";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import styles from "./CountryToggle.module.css";

type Props = {
  value: AddressCountry;
  /** 전환이 확정됐을 때 호출된다. 폼 값 초기화는 호출부의 책임. */
  onChange: (next: AddressCountry) => void;
  /** 지울 값이 있는지. 없으면 확인 없이 바로 전환한다. */
  hasValues: boolean;
  /** 확인 문구 — 주소인지 계좌인지에 따라 다르다. */
  confirmMessage: (next: AddressCountry) => string;
};

const COUNTRY_LABEL: Record<AddressCountry, () => string> = {
  JP: () => t("me.country.jp"),
  KR: () => t("me.country.kr"),
};

/**
 * 주소·계좌의 국가 선택. 활성 값은 하나뿐이라 전환하면 기존 입력이 지워진다.
 * 지울 값이 있을 때만 확인을 받는다 — 빈 폼에서 묻는 건 방해일 뿐이다.
 */
export function CountryToggle({
  value,
  onChange,
  hasValues,
  confirmMessage,
}: Props) {
  const [pending, setPending] = useState<AddressCountry | null>(null);

  function select(next: AddressCountry) {
    if (next === value) return;
    if (!hasValues) {
      onChange(next);
      return;
    }
    setPending(next);
  }

  return (
    <>
      <div className={styles.root} role="group" aria-label={t("me.country.label")}>
        {(["JP", "KR"] as const).map((country) => (
          <button
            key={country}
            type="button"
            className={[styles.option, country === value ? styles.optionOn : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={country === value}
            onClick={() => select(country)}
          >
            {COUNTRY_LABEL[country]()}
          </button>
        ))}
      </div>

      {pending !== null && (
        <ConfirmDialog
          message={confirmMessage(pending)}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            onChange(pending);
            setPending(null);
          }}
        />
      )}
    </>
  );
}

/** 열려 있는 동안에만 뒤 페이지 스크롤을 잠그도록 별도 컴포넌트로 둔다. */
function ConfirmDialog({
  message,
  onCancel,
  onConfirm,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useBodyScrollLock();

  return (
    <div className={styles.dim} role="dialog" aria-modal="true">
      <div className={styles.dialog}>
        <p className={styles.dialogBody}>{message}</p>
        <div className={styles.dialogActions}>
          <button type="button" className={styles.dialogCancel} onClick={onCancel}>
            {t("me.country.cancel")}
          </button>
          <button
            type="button"
            className={styles.dialogConfirm}
            onClick={onConfirm}
          >
            {t("me.country.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
