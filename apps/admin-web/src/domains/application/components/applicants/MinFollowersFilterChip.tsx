import { useState } from "react";
import { useT } from "@/lib/i18n";
import { FilterChip } from "@/components/composites/FilterChip";
import styles from "@/components/composites/FilterChip/FilterChip.module.css";

type Props = {
  value: number | null;
  onChange: (followers: number | null) => void;
};

export function MinFollowersFilterChip({ value, onChange }: Props) {
  const t = useT();
  const activeLabel =
    value !== null
      ? t("domains.application.applicants.minFollowersFilter.activeLabel", {
          count: value.toLocaleString(),
        })
      : null;

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel={t("domains.application.applicants.minFollowersFilter.chipEmpty")}
      onClear={() => onChange(null)}
      popoverTitle={t("domains.application.applicants.minFollowersFilter.title")}
      renderPopover={(close) => (
        <MinFollowersPopover value={value} onChange={onChange} close={close} />
      )}
    />
  );
}

// 열릴 때마다 새로 mount → 입력 draft 를 현재 값으로 초기화.
function MinFollowersPopover({
  value,
  onChange,
  close,
}: {
  value: number | null;
  onChange: (followers: number | null) => void;
  close: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(value !== null ? String(value) : "");

  const apply = () => {
    const raw = draft.trim();
    if (raw === "") {
      onChange(null);
    } else {
      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed >= 0) onChange(parsed);
    }
    close();
  };

  return (
    <>
      <div className={styles.popoverInputRow}>
        <input
          type="text"
          inputMode="numeric"
          className={styles.popoverInput}
          placeholder={t("domains.application.applicants.minFollowersFilter.placeholder")}
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              apply();
            }
          }}
        />
        <span className={styles.popoverSuffix}>
          {t("domains.application.applicants.minFollowersFilter.suffix")}
        </span>
      </div>
      <div className={styles.popoverActions}>
        <button type="button" className={styles.popoverBtnPrimary} onClick={apply}>
          {t("common.apply")}
        </button>
      </div>
    </>
  );
}
