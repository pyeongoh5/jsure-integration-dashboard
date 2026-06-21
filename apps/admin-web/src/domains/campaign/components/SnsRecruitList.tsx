import {
  isEnabledSnsType,
  type InstagramPostType,
  type SnsRecruit,
  type SnsType,
} from "@jsure/shared";
import styles from "./CampaignForm.module.css";

const INSTAGRAM_POST_TYPE_LABELS: Record<InstagramPostType, string> = {
  FEED: "피드",
  REELS: "릴스",
};
const INSTAGRAM_POST_TYPE_OPTIONS: readonly InstagramPostType[] = [
  "FEED",
  "REELS",
];

const OPTIONS: readonly {
  value: SnsType;
  label: string;
  followerLabel: string;
  icon: string;
}[] = [
  {
    value: "INSTAGRAM",
    label: "인스타그램",
    followerLabel: "팔로워",
    icon: "fa-brands fa-instagram",
  },
  {
    value: "TIKTOK",
    label: "틱톡",
    followerLabel: "팔로워",
    icon: "fa-brands fa-tiktok",
  },
  {
    value: "X",
    label: "X",
    followerLabel: "팔로워",
    icon: "fa-brands fa-x-twitter",
  },
  {
    value: "YOUTUBE",
    label: "유튜브",
    followerLabel: "구독자",
    icon: "fa-brands fa-youtube",
  },
];

const VISIBLE_OPTIONS = OPTIONS.filter((opt) => isEnabledSnsType(opt.value));

const SNS_ICON_CLASS: Record<SnsType, string | undefined> = {
  INSTAGRAM: styles.snsIconInstagram,
  TIKTOK: styles.snsIconTiktok,
  X: styles.snsIconX,
  YOUTUBE: styles.snsIconYoutube,
};

type ItemError = Partial<
  Record<"minFollowers" | "recruitCount" | "instagramPostTypes", string>
>;

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
      onChange([
        ...value,
        {
          snsType: sns,
          minFollowers: 0,
          recruitCount: 1,
          instagramPostTypes: sns === "INSTAGRAM" ? ["FEED"] : [],
          insightRequired: true,
        },
      ]);
    }
  };

  const toggleInstagramPostType = (idx: number, postType: InstagramPostType) => {
    const current = value[idx];
    if (!current) return;
    const set = new Set<InstagramPostType>(current.instagramPostTypes);
    if (set.has(postType)) set.delete(postType);
    else set.add(postType);
    updateAt(idx, {
      instagramPostTypes: INSTAGRAM_POST_TYPE_OPTIONS.filter((option) =>
        set.has(option),
      ),
    });
  };

  const updateAt = (idx: number, patch: Partial<SnsRecruit>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch } as SnsRecruit;
    onChange(next);
  };

  return (
    <div className={styles.snsRecruits}>
      {VISIBLE_OPTIONS.map((opt) => {
        const idx = indexOf(opt.value);
        const selected = idx >= 0;
        const row = selected ? value[idx] : null;
        const err = selected ? errorByIndex?.[idx] : undefined;
        return (
          <div
            key={opt.value}
            className={`${styles.snsRow}${selected ? ` ${styles.snsRowOn}` : ""}`}
          >
            <label className={styles.snsToggle}>
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(opt.value)}
              />
              <i
                className={`${opt.icon} ${styles.snsIcon} ${SNS_ICON_CLASS[opt.value] ?? ""}`}
                aria-hidden="true"
              />
              <span className={styles.snsToggleLabel}>{opt.label}</span>
            </label>
            {selected && row ? (
              <div className={styles.snsFields}>
                <div className={styles.snsField}>
                  <label className={styles.subLabel}>
                    최소 {opt.followerLabel}
                  </label>
                  <div className={styles.snsCountRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.input}
                      placeholder="0"
                      value={
                        Number.isFinite(row.minFollowers)
                          ? String(row.minFollowers)
                          : ""
                      }
                      disabled={disabled}
                      onChange={(event) =>
                        updateAt(idx, {
                          minFollowers: parseIntegerInput(event.target.value),
                        })
                      }
                    />
                    <span className={styles.snsSuffix}>명 이상</span>
                  </div>
                  {err?.minFollowers && (
                    <div className={styles.error}>{err.minFollowers}</div>
                  )}
                </div>
                <div className={styles.snsField}>
                  <label className={styles.subLabel}>모집 인원</label>
                  <div className={styles.snsCountRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.input}
                      value={
                        Number.isFinite(row.recruitCount)
                          ? String(row.recruitCount)
                          : ""
                      }
                      disabled={disabled}
                      onChange={(event) =>
                        updateAt(idx, {
                          recruitCount: parseIntegerInput(event.target.value),
                        })
                      }
                    />
                    <span className={styles.snsSuffix}>명</span>
                  </div>
                  {err?.recruitCount && (
                    <div className={styles.error}>{err.recruitCount}</div>
                  )}
                </div>
                {opt.value === "INSTAGRAM" && (
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>모집 포스트 타입</label>
                    <div className={styles.snsCountRow}>
                      {INSTAGRAM_POST_TYPE_OPTIONS.map((postType) => (
                        <label
                          key={postType}
                          className={styles.snsToggle}
                          style={{ marginRight: 12 }}
                        >
                          <input
                            type="checkbox"
                            checked={row.instagramPostTypes.includes(postType)}
                            disabled={disabled}
                            onChange={() =>
                              toggleInstagramPostType(idx, postType)
                            }
                          />
                          <span className={styles.snsToggleLabel}>
                            {INSTAGRAM_POST_TYPE_LABELS[postType]}
                          </span>
                        </label>
                      ))}
                    </div>
                    {err?.instagramPostTypes && (
                      <div className={styles.error}>
                        {err.instagramPostTypes}
                      </div>
                    )}
                  </div>
                )}
                <div className={styles.snsField}>
                  <label className={styles.snsToggle}>
                    <input
                      type="checkbox"
                      checked={row.insightRequired}
                      disabled={disabled}
                      onChange={() =>
                        updateAt(idx, { insightRequired: !row.insightRequired })
                      }
                    />
                    <span className={styles.snsToggleLabel}>
                      인사이트 제출 필수
                    </span>
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
