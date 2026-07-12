import { useEffect } from "react";
import {
  isEnabledSnsType,
  QOO10_REVIEW_CHANNEL_LABEL,
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
const INSTAGRAM_POST_TYPE_OPTIONS: readonly InstagramPostType[] = ["FEED", "REELS"];

const QOO10_REVIEW_CHANNEL_OPTIONS: readonly ("LIPS" | "ATCOSME")[] = ["LIPS", "ATCOSME"];

type SubTypeMeta = {
  followerLabel: string;
  icon: string;
  iconClass?: string;
};

const SNS_ACCOUNT_SUB_TYPES: readonly SnsAccountSubType[] = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];

function isSnsAccountSubType(subType: CampaignSubType): subType is SnsAccountSubType {
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
    icon: "fa-solid fa-heart",
  },
  ATCOSME: {
    followerLabel: "팔로워",
    icon: "fa-solid fa-star",
  },
};

type ItemError = Partial<
  Record<
    "minFollowers" | "recruitCount" | "subTypeOptions" | "productPriceJpy" | "productUrl",
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
      subTypeOptions: subType === "INSTAGRAM" ? ["FEED"] : [],
      insightRequired: true,
      productPriceJpy: null,
      productUrl: null,
    };
  }
  if (category === "SIMPLE_REVIEW") {
    return {
      subType,
      minFollowers: 0,
      recruitCount: 1,
      subTypeOptions: [],
      insightRequired: false,
      productPriceJpy: null,
      productUrl: null,
    };
  }
  return {
    subType,
    minFollowers: 0,
    recruitCount: 1,
    subTypeOptions: [],
    insightRequired: false,
    productPriceJpy: Number.NaN as unknown as number,
    productUrl: "",
  };
}

export function RecruitList({ category, value, onChange, disabled, errorByIndex }: Props) {
  const candidates = subTypesForCategory(category).filter((subType) => {
    if (category === "SNS" && isSnsAccountSubType(subType)) {
      return isEnabledSnsType(subType);
    }
    return true;
  });

  const indexOf = (subType: CampaignFormRecruitSubType): number =>
    value.findIndex((recruit) => recruit.subType === subType);

  // 가구매 카테고리는 QOO10 recruit 을 항상 유지한다.
  const isFakePurchase = category === "FAKE_PURCHASE";
  const hasQoo10Recruit = value.some((recruit) => recruit.subType === "QOO10");
  useEffect(() => {
    if (isFakePurchase && !hasQoo10Recruit) {
      onChange([createRecruit(category, "QOO10")]);
    }
  }, [isFakePurchase, hasQoo10Recruit, category, onChange]);

  const toggle = (subType: CampaignFormRecruitSubType) => {
    const index = indexOf(subType);
    if (index >= 0) {
      onChange(value.filter((_, i) => i !== index));
    } else {
      onChange([...value, createRecruit(category, subType)]);
    }
  };

  const toggleInstagramPostType = (index: number, postType: InstagramPostType) => {
    const current = value[index];
    if (!current) return;
    const set = new Set<string>(current.subTypeOptions);
    if (set.has(postType)) set.delete(postType);
    else set.add(postType);
    updateAt(index, {
      subTypeOptions: INSTAGRAM_POST_TYPE_OPTIONS.filter((option) => set.has(option)),
    });
  };

  const toggleQoo10Channel = (index: number, channel: "LIPS" | "ATCOSME") => {
    const current = value[index];
    if (!current) return;
    const set = new Set<string>(current.subTypeOptions);
    if (set.has(channel)) set.delete(channel);
    else set.add(channel);
    updateAt(index, {
      subTypeOptions: QOO10_REVIEW_CHANNEL_OPTIONS.filter((option) => set.has(option)),
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
        const isQoo10 = isFakePurchase && subType === "QOO10";
        return (
          <div
            key={subType}
            className={`${styles.snsRow}${selected || isQoo10 ? ` ${styles.snsRowOn}` : ""}`}
          >
            {isQoo10 ? (
              <div className={styles.snsToggle}>
                <i
                  className={`${meta.icon} ${styles.snsIcon} ${meta.iconClass ?? ""}`}
                  aria-hidden="true"
                />
                <span className={styles.snsToggleLabel}>{SUB_TYPE_LABEL[subType]}</span>
              </div>
            ) : (
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
                <span className={styles.snsToggleLabel}>{SUB_TYPE_LABEL[subType]}</span>
              </label>
            )}
            {selected && row ? (
              category === "SIMPLE_REVIEW" ? (
                <div className={styles.snsFields}>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>모집 인원</label>
                    <div className={styles.snsCountRow}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.input}
                        value={Number.isFinite(row.recruitCount) ? String(row.recruitCount) : ""}
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
                </div>
              ) : category === "SNS" ? (
                <div className={styles.snsFields}>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>최소 {meta.followerLabel}</label>
                    <div className={styles.snsCountRow}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder="0"
                        value={Number.isFinite(row.minFollowers) ? String(row.minFollowers) : ""}
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
                        value={Number.isFinite(row.recruitCount) ? String(row.recruitCount) : ""}
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
                              checked={row.subTypeOptions.includes(postType)}
                              disabled={disabled}
                              onChange={() => toggleInstagramPostType(index, postType)}
                            />
                            <span className={styles.snsToggleLabel}>
                              {INSTAGRAM_POST_TYPE_LABELS[postType]}
                            </span>
                          </label>
                        ))}
                      </div>
                      {errors?.subTypeOptions && (
                        <div className={styles.error}>{errors.subTypeOptions}</div>
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
                      <span className={styles.snsToggleLabel}>인사이트 제출 필수</span>
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
                        value={Number.isFinite(row.recruitCount) ? String(row.recruitCount) : ""}
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
                      <div className={styles.error}>{errors.productPriceJpy}</div>
                    )}
                  </div>
                  <div className={styles.snsField} style={{ gridColumn: "1 / -1" }}>
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
                    {errors?.productUrl && <div className={styles.error}>{errors.productUrl}</div>}
                  </div>
                  {subType === "QOO10" && (
                    <div className={styles.snsField} style={{ gridColumn: "1 / -1" }}>
                      <label className={styles.subLabel}>리뷰 채널 (선택)</label>
                      <div className={styles.snsCountRow}>
                        {QOO10_REVIEW_CHANNEL_OPTIONS.map((channel) => (
                          <label
                            key={channel}
                            className={styles.snsToggle}
                            style={{ marginRight: 12 }}
                          >
                            <input
                              type="checkbox"
                              checked={row.subTypeOptions.includes(channel)}
                              disabled={disabled}
                              onChange={() => toggleQoo10Channel(index, channel)}
                            />
                            <span className={styles.snsToggleLabel}>
                              {QOO10_REVIEW_CHANNEL_LABEL[channel]}
                            </span>
                          </label>
                        ))}
                      </div>
                      {errors?.subTypeOptions && (
                        <div className={styles.error}>{errors.subTypeOptions}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
