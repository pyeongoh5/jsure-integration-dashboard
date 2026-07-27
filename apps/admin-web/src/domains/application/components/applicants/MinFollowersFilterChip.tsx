import { useState } from "react";
import { FilterChip } from "@/components/composites/FilterChip";
import styles from "@/components/composites/FilterChip/FilterChip.module.css";

type Props = {
  value: number | null;
  onChange: (followers: number | null) => void;
};

export function MinFollowersFilterChip({ value, onChange }: Props) {
  const activeLabel =
    value !== null ? `팔로워 ${value.toLocaleString()}명 이상` : null;

  return (
    <FilterChip
      activeLabel={activeLabel}
      emptyLabel="+ 팔로워 범위"
      onClear={() => onChange(null)}
      popoverTitle="팔로워 최소값"
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
          placeholder="예: 10000"
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
        <span className={styles.popoverSuffix}>명 이상</span>
      </div>
      <div className={styles.popoverActions}>
        <button type="button" className={styles.popoverBtnPrimary} onClick={apply}>
          적용
        </button>
      </div>
    </>
  );
}
