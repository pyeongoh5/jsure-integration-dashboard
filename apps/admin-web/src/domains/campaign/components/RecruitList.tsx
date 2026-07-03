import {
  isEnabledSnsType,
  SUB_TYPE_LABEL,
  subTypesForCategory,
  type CampaignCategory,
  type CampaignSubType,
  type InstagramPostType,
  type SnsAccountSubType,
} from "@jsure/shared";
import type { CampaignFormRecruit, CampaignFormRecruitSubType } from "../types";
import styles from "./CampaignForm.module.css";

const INSTAGRAM_POST_TYPE_LABELS: Record<InstagramPostType, string> = {
  FEED: "피드",
  REELS: "릴스",
};
const INSTAGRAM_POST_TYPE_OPTIONS: readonly InstagramPostType[] = [
  "FEED",
  "REELS",
];

type SubTypeMeta = {
  followerLabel: string;
  icon: string;
  iconClass?: string;
};

const SNS_ACCOUNT_SUB_TYPES: readonly SnsAccountSubType[] = [
  "INSTAGRAM",
  "TIKTOK",
  "X",
  "YOUTUBE",
];

function isSnsAccountSubType(
  subType: CampaignSubType,
): subType is SnsAccountSubType {
  return (SNS_ACCOUNT_SUB_TYPES as readonly CampaignSubType[]).includes(subType);
}

const SUB_TYPE_META: Record<CampaignSubType, SubTypeMeta> = {
  INSTAGRAM: {
    followerLabel: "팔로워",
    icon: "fa-brands fa-instagram",
    iconClass: styles.snsIconInstagram,
  },
  TIKTOK: {
    followerLabel: "팔로워",
    icon: "fa-brands fa-tiktok",
    iconClass: styles.snsIconTiktok,
  },
  X: {
    followerLabel: "팔로워",
    icon: "fa-brands fa-x-twitter",
    iconClass: styles.snsIconX,
  },
  YOUTUBE: {
    followerLabel: "구독자",
    icon: "fa-brands fa-youtube",
    iconClass: styles.snsIconYoutube,
  },
  QOO10: {
    followerLabel: "팔로워",
    icon: "fa-solid fa-bag-shopping",
  },
  LIPS: {
    followerLabel: "팔로워",
    icon: "fa-solid fa-bag-shopping",
  },
  ATCOSME: {
    followerLabel: "팔로워",
    icon: "fa-solid fa-bag-shopping",
  },
};

type ItemError = Partial<
  Record<
    | "minFollowers"
    | "recruitCount"
    | "instagramPostTypes"
    | "productPriceJpy"
    | "productUrl",
    string
  >
>;

type Props = {
  category: CampaignCategory;
  value: CampaignFormRecruit[];
  onChange: (next: CampaignFormRecruit[]) => void;
  disabled?: boolean;
  errorByIndex?: Record<number, ItemError | undefined>;
};

function parseIntegerInput(raw: string): number {
  if (raw.trim() === "") return Number.NaN;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function createRecruit(
  category: CampaignCategory,
  subType: CampaignFormRecruitSubType,
): CampaignFormRecruit {
  if (category === "SNS") {
    return {
      subType,
      minFollowers: 0,
      recruitCount: 1,
      instagramPostTypes: subType === "INSTAGRAM" ? ["FEED"] : [],
      insightRequired: true,
      productPriceJpy: null,
      productUrl: null,
    };
  }
  return {
    subType,
    minFollowers: 0,
    recruitCount: 1,
    instagramPostTypes: [],
    insightRequired: false,
    productPriceJpy: Number.NaN as unknown as number,
    productUrl: "",
  };
}

export function RecruitList({
  category,
  value,
  onChange,
  disabled,
  errorByIndex,
}: Props) {
  const candidates = subTypesForCategory(category).filter((subType) => {
    if (category === "SNS" && isSnsAccountSubType(subType)) {
      return isEnabledSnsType(subType);
    }
    return true;
  });

  const indexOf = (subType: CampaignFormRecruitSubType): number =>
    value.findIndex((recruit) => recruit.subType === subType);

  const toggle = (subType: CampaignFormRecruitSubType) => {
    const index = indexOf(subType);
    if (index >= 0) {
      onChange(value.filter((_, i) => i !== index));
    } else {
      onChange([...value, createRecruit(category, subType)]);
    }
  };

  const toggleInstagramPostType = (
    index: number,
    postType: InstagramPostType,
  ) => {
    const current = value[index];
    if (!current) return;
    const set = new Set<InstagramPostType>(current.instagramPostTypes);
    if (set.has(postType)) set.delete(postType);
    else set.add(postType);
    updateAt(index, {
      instagramPostTypes: INSTAGRAM_POST_TYPE_OPTIONS.filter((option) =>
        set.has(option),
      ),
    });
  };

  const updateAt = (index: number, patch: Partial<CampaignFormRecruit>) => {
    const next = value.slice();
    next[index] = { ...next[index], ...patch } as CampaignFormRecruit;
    onChange(next);
  };

  return (
    <div className={styles.snsRecruits}>
      {candidates.map((subType) => {
        const index = indexOf(subType);
        const selected = index >= 0;
        const row = selected ? value[index] : null;
        const errors = selected ? errorByIndex?.[index] : undefined;
        const meta = SUB_TYPE_META[subType];
        return (
          <div
            key={subType}
            className={`${styles.snsRow}${selected ? ` ${styles.snsRowOn}` : ""}`}
          >
            <label className={styles.snsToggle}>
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                onChange={() => toggle(subType)}
              />
              <i
                className={`${meta.icon} ${styles.snsIcon} ${meta.iconClass ?? ""}`}
                aria-hidden="true"
              />
              <span className={styles.snsToggleLabel}>
                {SUB_TYPE_LABEL[subType]}
              </span>
            </label>
            {selected && row ? (
              category === "SNS" ? (
                <div className={styles.snsFields}>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>
                      최소 {meta.followerLabel}
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
                          updateAt(index, {
                            minFollowers: parseIntegerInput(event.target.value),
                          })
                        }
                      />
                      <span className={styles.snsSuffix}>명 이상</span>
                    </div>
                    {errors?.minFollowers && (
                      <div className={styles.error}>{errors.minFollowers}</div>
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
                          updateAt(index, {
                            recruitCount: parseIntegerInput(event.target.value),
                          })
                        }
                      />
                      <span className={styles.snsSuffix}>명</span>
                    </div>
                    {errors?.recruitCount && (
                      <div className={styles.error}>{errors.recruitCount}</div>
                    )}
                  </div>
                  {subType === "INSTAGRAM" && (
                    <div className={styles.snsField}>
                      <label className={styles.subLabel}>
                        모집 포스트 타입
                      </label>
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
                                toggleInstagramPostType(index, postType)
                              }
                            />
                            <span className={styles.snsToggleLabel}>
                              {INSTAGRAM_POST_TYPE_LABELS[postType]}
                            </span>
                          </label>
                        ))}
                      </div>
                      {errors?.instagramPostTypes && (
                        <div className={styles.error}>
                          {errors.instagramPostTypes}
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`${styles.snsField} ${styles.snsFieldRight}`}>
                    <label className={styles.snsToggle}>
                      <input
                        type="checkbox"
                        checked={row.insightRequired}
                        disabled={disabled}
                        onChange={() =>
                          updateAt(index, {
                            insightRequired: !row.insightRequired,
                          })
                        }
                      />
                      <span className={styles.snsToggleLabel}>
                        인사이트 제출 필수
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className={styles.snsFields}>
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
                          updateAt(index, {
                            recruitCount: parseIntegerInput(event.target.value),
                          })
                        }
                      />
                      <span className={styles.snsSuffix}>명</span>
                    </div>
                    {errors?.recruitCount && (
                      <div className={styles.error}>{errors.recruitCount}</div>
                    )}
                  </div>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>상품 가격 (JPY)</label>
                    <div className={styles.snsCountRow}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder="예시: 1980"
                        value={
                          typeof row.productPriceJpy === "number" &&
                          Number.isFinite(row.productPriceJpy)
                            ? String(row.productPriceJpy)
                            : ""
                        }
                        disabled={disabled}
                        onChange={(event) => {
                          const parsed = parseIntegerInput(event.target.value);
                          updateAt(index, {
                            productPriceJpy: Number.isFinite(parsed)
                              ? parsed
                              : (Number.NaN as unknown as number),
                          });
                        }}
                      />
                      <span className={styles.snsSuffix}>円</span>
                    </div>
                    {errors?.productPriceJpy && (
                      <div className={styles.error}>
                        {errors.productPriceJpy}
                      </div>
                    )}
                  </div>
                  <div
                    className={styles.snsField}
                    style={{ gridColumn: "1 / -1" }}
                  >
                    <label className={styles.subLabel}>상품 URL</label>
                    <input
                      type="url"
                      className={styles.input}
                      placeholder="https://..."
                      value={row.productUrl ?? ""}
                      disabled={disabled}
                      onChange={(event) =>
                        updateAt(index, {
                          productUrl: event.target.value,
                        })
                      }
                    />
                    {errors?.productUrl && (
                      <div className={styles.error}>{errors.productUrl}</div>
                    )}
                  </div>
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
