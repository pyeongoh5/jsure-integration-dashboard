import type { SnsRecruit, SnsType } from "@jsure/shared";

const OPTIONS: readonly {
  value: SnsType;
  label: string;
  followerLabel: string;
  icon: string;
  iconClass: string;
}[] = [
  {
    value: "INSTAGRAM",
    label: "인스타그램",
    followerLabel: "팔로워",
    icon: "fa-brands fa-instagram",
    iconClass: "cf__sns-icon--instagram",
  },
  {
    value: "TIKTOK",
    label: "틱톡",
    followerLabel: "팔로워",
    icon: "fa-brands fa-tiktok",
    iconClass: "cf__sns-icon--tiktok",
  },
  {
    value: "X",
    label: "X",
    followerLabel: "팔로워",
    icon: "fa-brands fa-x-twitter",
    iconClass: "cf__sns-icon--x",
  },
  {
    value: "YOUTUBE",
    label: "유튜브",
    followerLabel: "구독자",
    icon: "fa-brands fa-youtube",
    iconClass: "cf__sns-icon--youtube",
  },
];

type ItemError = Partial<Record<"minFollowers" | "recruitCount", string>>;

type Props = {
  value: SnsRecruit[];
  onChange: (next: SnsRecruit[]) => void;
  disabled?: boolean;
  errorByIndex?: Record<number, ItemError | undefined>;
};

function parseIntegerInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const n = Number(raw);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function SnsRecruitList({ value, onChange, disabled, errorByIndex }: Props) {
  const indexOf = (sns: SnsType): number =>
    value.findIndex((r) => r.snsType === sns);

  const toggle = (sns: SnsType) => {
    const idx = indexOf(sns);
    if (idx >= 0) {
      onChange(value.filter((_, i) => i !== idx));
    } else {
      onChange([...value, { snsType: sns, minFollowers: 0, recruitCount: 1 }]);
    }
  };

  const updateAt = (idx: number, patch: Partial<SnsRecruit>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch } as SnsRecruit;
    onChange(next);
  };

  return (
    <div className="cf__sns-recruits">
      {OPTIONS.map((opt) => {
        const idx = indexOf(opt.value);
        const selected = idx >= 0;
        const row = selected ? value[idx] : null;
        const err = selected ? errorByIndex?.[idx] : undefined;
        return (
          <div
            key={opt.value}
            className={`cf__sns-row${selected ? " cf__sns-row--on" : ""}`}
          >
            <label className="cf__sns-toggle">
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(opt.value)}
              />
              <i
                className={`${opt.icon} cf__sns-icon ${opt.iconClass}`}
                aria-hidden="true"
              />
              <span className="cf__sns-toggle-label">{opt.label}</span>
            </label>
            {selected && row ? (
              <div className="cf__sns-fields">
                <div className="cf__sns-field">
                  <label className="cf__sub-label">
                    최소 {opt.followerLabel}
                  </label>
                  <div className="cf__sns-count-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="cf__input"
                      placeholder="0"
                      value={
                        Number.isFinite(row.minFollowers)
                          ? String(row.minFollowers)
                          : ""
                      }
                      disabled={disabled}
                      onChange={(e) =>
                        updateAt(idx, {
                          minFollowers: parseIntegerInput(e.target.value),
                        })
                      }
                    />
                    <span className="cf__sns-suffix">명 이상</span>
                  </div>
                  {err?.minFollowers && (
                    <div className="cf__error">{err.minFollowers}</div>
                  )}
                </div>
                <div className="cf__sns-field cf__sns-field--count">
                  <label className="cf__sub-label">모집 인원</label>
                  <div className="cf__sns-count-row">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="cf__input"
                      value={
                        Number.isFinite(row.recruitCount)
                          ? String(row.recruitCount)
                          : ""
                      }
                      disabled={disabled}
                      onChange={(e) =>
                        updateAt(idx, {
                          recruitCount: parseIntegerInput(e.target.value),
                        })
                      }
                    />
                    <span className="cf__sns-suffix">명</span>
                  </div>
                  {err?.recruitCount && (
                    <div className="cf__error">{err.recruitCount}</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
