import { useEffect } from "react";
import {
  isEnabledSnsType,
  QOO10_REVIEW_CHANNEL_LABEL,
  SUB_TYPE_LABEL,
  subTypesForCategory,
  type CampaignCategory,
  type CampaignSubType,
  type InstagramPostType,
  type RewardType,
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
    | "minFollowers"
    | "recruitCount"
    | "rewardJpy"
    | "subTypeOptions"
    | "options"
    | "productPriceJpy"
    | "productUrl",
    string
  >
>;

type RecruitOptionRow = CampaignFormRecruit["options"][number];

/** 옵션 행 전부에 해당 속성이 입력 시도(non-null)되어 있으면 분리 모드로 본다. */
function optionAttributeOn(
  row: CampaignFormRecruit,
  attribute: "recruitCount" | "rewardJpy",
): boolean {
  return (
    row.options.length > 0 &&
    row.options.every((option) => option[attribute] !== null)
  );
}

/** 정원 분리 시 부모 모집 인원 = 옵션 정원 합계 (미입력 있으면 NaN). */
function optionCountSum(options: RecruitOptionRow[]): number {
  return options.reduce(
    (sum, option) => sum + (option.recruitCount ?? Number.NaN),
    0,
  );
}

type Props = {
  category: CampaignCategory;
  rewardType: RewardType;
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
      rewardJpy: null,
      subTypeOptions: subType === "INSTAGRAM" ? ["FEED"] : [],
      options: [],
      insightRequired: true,
      isRequired: false,
      productPriceJpy: null,
      productUrl: null,
    };
  }
  if (category === "SIMPLE_REVIEW") {
    return {
      subType,
      minFollowers: 0,
      recruitCount: 1,
      rewardJpy: null,
      subTypeOptions: [],
      options: [],
      insightRequired: false,
      isRequired: false,
      productPriceJpy: null,
      productUrl: null,
    };
  }
  return {
    subType,
    minFollowers: 0,
    recruitCount: 1,
    rewardJpy: null,
    subTypeOptions: [],
    options: [],
    insightRequired: false,
    isRequired: false,
    productPriceJpy: Number.NaN as unknown as number,
    productUrl: "",
  };
}

export function RecruitList({
  category,
  rewardType,
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
    const subTypeOptions = INSTAGRAM_POST_TYPE_OPTIONS.filter((option) =>
      set.has(option),
    );
    // 옵션별 설정 사용 중이면 행 집합을 허용 옵션과 1:1 로 재동기화.
    const countSplit = optionAttributeOn(current, "recruitCount");
    const rewardSplit = optionAttributeOn(current, "rewardJpy");
    const options =
      current.options.length === 0
        ? current.options
        : subTypeOptions.map(
            (name) =>
              current.options.find((option) => option.option === name) ?? {
                option: name,
                recruitCount: countSplit ? Number.NaN : null,
                rewardJpy: rewardSplit ? Number.NaN : null,
              },
          );
    updateAt(index, {
      subTypeOptions,
      options,
      ...(countSplit ? { recruitCount: optionCountSum(options) } : {}),
    });
  };

  /** 옵션별 정원/보수 분리 토글. 켜면 허용 옵션 전부에 입력 행 생성, 끄면 속성 제거. */
  const toggleOptionAttribute = (
    index: number,
    attribute: "recruitCount" | "rewardJpy",
  ) => {
    const current = value[index];
    if (!current) return;
    const on = optionAttributeOn(current, attribute);
    let options: RecruitOptionRow[];
    if (on) {
      options = current.options.map((option) => ({
        ...option,
        [attribute]: null,
      }));
      if (
        options.every(
          (option) => option.recruitCount === null && option.rewardJpy === null,
        )
      ) {
        options = [];
      }
    } else {
      options = current.subTypeOptions.map((name) => {
        const existing = current.options.find(
          (option) => option.option === name,
        );
        return {
          option: name,
          recruitCount: existing?.recruitCount ?? null,
          rewardJpy: existing?.rewardJpy ?? null,
          [attribute]: existing?.[attribute] ?? Number.NaN,
        };
      });
    }
    const countSplit =
      options.length > 0 &&
      options.every((option) => option.recruitCount !== null);
    updateAt(index, {
      options,
      // 정원 분리 시 부모 인원은 합계, 해제 시 기존 값 유지.
      ...(countSplit ? { recruitCount: optionCountSum(options) } : {}),
      // 보수 분리 시 부모 보수는 비운다 (응모는 옵션 1개만 고르므로 대표값이 없다).
      ...(attribute === "rewardJpy" && !on ? { rewardJpy: null } : {}),
    });
  };

  const updateOptionAt = (
    index: number,
    optionIndex: number,
    patch: Partial<RecruitOptionRow>,
  ) => {
    const current = value[index];
    if (!current) return;
    const options = current.options.map((option, i) =>
      i === optionIndex ? { ...option, ...patch } : option,
    );
    const countSplit =
      options.length > 0 &&
      options.every((option) => option.recruitCount !== null);
    updateAt(index, {
      options,
      ...(countSplit ? { recruitCount: optionCountSum(options) } : {}),
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

  // 개별 보수(PER_SUBTYPE) 캠페인에서만 노출되는 서브타입별 보수 입력.
  const renderRewardField = (
    index: number,
    row: CampaignFormRecruit,
    errors: ItemError | undefined,
  ) => {
    if (rewardType !== "PER_SUBTYPE") return null;
    // 옵션별 보수 분리 시 서브타입 보수 입력은 숨긴다 (옵션 행에서 입력).
    if (optionAttributeOn(row, "rewardJpy")) return null;
    return (
      <div className={styles.snsField}>
        <label className={styles.subLabel}>보수 금액 (JPY)</label>
        <div className={styles.snsCountRow}>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            placeholder="예시: 5000"
            value={
              typeof row.rewardJpy === "number" && Number.isFinite(row.rewardJpy)
                ? String(row.rewardJpy)
                : ""
            }
            disabled={disabled}
            onChange={(event) => {
              const parsed = parseIntegerInput(event.target.value);
              updateAt(index, {
                rewardJpy: Number.isFinite(parsed) ? parsed : null,
              });
            }}
          />
          <span className={styles.snsSuffix}>円</span>
        </div>
        {errors?.rewardJpy && <div className={styles.error}>{errors.rewardJpy}</div>}
      </div>
    );
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
                  {renderRewardField(index, row, errors)}
                  <div className={`${styles.snsField} ${styles.snsFieldRight}`}>
                    <label className={styles.snsToggle}>
                      <input
                        type="checkbox"
                        checked={row.isRequired}
                        disabled={disabled}
                        onChange={() =>
                          updateAt(index, {
                            isRequired: !row.isRequired,
                          })
                        }
                      />
                      <span className={styles.snsToggleLabel}>
                        응모 필수
                      </span>
                    </label>
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
                    <label className={styles.subLabel}>
                      모집 인원
                      {optionAttributeOn(row, "recruitCount") && " (타입별 합계)"}
                    </label>
                    <div className={styles.snsCountRow}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.input}
                        value={Number.isFinite(row.recruitCount) ? String(row.recruitCount) : ""}
                        disabled={disabled}
                        readOnly={optionAttributeOn(row, "recruitCount")}
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
                  {renderRewardField(index, row, errors)}
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
                  {subType === "INSTAGRAM" && row.subTypeOptions.length > 0 && (
                    <div className={styles.snsField} style={{ gridColumn: "1 / -1" }}>
                      <label className={styles.subLabel}>포스트 타입별 세부 설정</label>
                      <div className={styles.snsCountRow}>
                        <label className={styles.snsToggle} style={{ marginRight: 12 }}>
                          <input
                            type="checkbox"
                            checked={optionAttributeOn(row, "recruitCount")}
                            disabled={disabled}
                            onChange={() => toggleOptionAttribute(index, "recruitCount")}
                          />
                          <span className={styles.snsToggleLabel}>타입별 인원</span>
                        </label>
                        {rewardType === "PER_SUBTYPE" && (
                          <label className={styles.snsToggle}>
                            <input
                              type="checkbox"
                              checked={optionAttributeOn(row, "rewardJpy")}
                              disabled={disabled}
                              onChange={() => toggleOptionAttribute(index, "rewardJpy")}
                            />
                            <span className={styles.snsToggleLabel}>타입별 보수</span>
                          </label>
                        )}
                      </div>
                      {row.options.map((optionRow, optionIndex) => (
                        <div
                          key={optionRow.option}
                          className={styles.snsCountRow}
                          style={{ marginTop: 6 }}
                        >
                          <span className={styles.snsToggleLabel} style={{ minWidth: 36 }}>
                            {INSTAGRAM_POST_TYPE_LABELS[
                              optionRow.option as InstagramPostType
                            ] ?? optionRow.option}
                          </span>
                          {optionAttributeOn(row, "recruitCount") && (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                className={styles.input}
                                style={{ maxWidth: 90 }}
                                placeholder="인원"
                                value={
                                  typeof optionRow.recruitCount === "number" &&
                                  Number.isFinite(optionRow.recruitCount)
                                    ? String(optionRow.recruitCount)
                                    : ""
                                }
                                disabled={disabled}
                                onChange={(event) =>
                                  updateOptionAt(index, optionIndex, {
                                    recruitCount: parseIntegerInput(event.target.value),
                                  })
                                }
                              />
                              <span className={styles.snsSuffix}>명</span>
                            </>
                          )}
                          {optionAttributeOn(row, "rewardJpy") && (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                className={styles.input}
                                style={{ maxWidth: 110 }}
                                placeholder="보수"
                                value={
                                  typeof optionRow.rewardJpy === "number" &&
                                  Number.isFinite(optionRow.rewardJpy)
                                    ? String(optionRow.rewardJpy)
                                    : ""
                                }
                                disabled={disabled}
                                onChange={(event) =>
                                  updateOptionAt(index, optionIndex, {
                                    rewardJpy: parseIntegerInput(event.target.value),
                                  })
                                }
                              />
                              <span className={styles.snsSuffix}>円</span>
                            </>
                          )}
                        </div>
                      ))}
                      {errors?.options && (
                        <div className={styles.error}>{errors.options}</div>
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
                    <label className={styles.snsToggle} style={{ marginTop: 8 }}>
                      <input
                        type="checkbox"
                        checked={row.isRequired}
                        disabled={disabled}
                        onChange={() =>
                          updateAt(index, {
                            isRequired: !row.isRequired,
                          })
                        }
                      />
                      <span className={styles.snsToggleLabel}>
                        응모 필수
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
                  {renderRewardField(index, row, errors)}
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
