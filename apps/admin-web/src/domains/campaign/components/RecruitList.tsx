import { useEffect } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
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
import { useT } from "@/lib/i18n";
import { INSTAGRAM_POST_TYPE_LABEL, type CampaignFormRecruit, type CampaignFormRecruitSubType } from "../types";
import styles from "./CampaignForm.module.css";

const INSTAGRAM_POST_TYPE_OPTIONS: readonly InstagramPostType[] = ["FEED", "REELS"];

const QOO10_REVIEW_CHANNEL_OPTIONS: readonly ("LIPS" | "ATCOSME")[] = ["LIPS", "ATCOSME"];

type SubTypeMeta = {
  followerLabel: AdminTranslationKey;
  icon: string;
  iconClass?: string;
};

const SNS_ACCOUNT_SUB_TYPES: readonly SnsAccountSubType[] = ["INSTAGRAM", "TIKTOK", "X", "YOUTUBE"];

function isSnsAccountSubType(subType: CampaignSubType): subType is SnsAccountSubType {
  return (SNS_ACCOUNT_SUB_TYPES as readonly CampaignSubType[]).includes(subType);
}

const SUB_TYPE_META: Record<CampaignSubType, SubTypeMeta> = {
  INSTAGRAM: {
    followerLabel: "domains.campaign.followerLabel.follower",
    icon: "fa-brands fa-instagram",
    iconClass: styles.snsIconInstagram,
  },
  TIKTOK: {
    followerLabel: "domains.campaign.followerLabel.follower",
    icon: "fa-brands fa-tiktok",
    iconClass: styles.snsIconTiktok,
  },
  X: {
    followerLabel: "domains.campaign.followerLabel.follower",
    icon: "fa-brands fa-x-twitter",
    iconClass: styles.snsIconX,
  },
  YOUTUBE: {
    followerLabel: "domains.campaign.followerLabel.subscriber",
    icon: "fa-brands fa-youtube",
    iconClass: styles.snsIconYoutube,
  },
  QOO10: {
    followerLabel: "domains.campaign.followerLabel.follower",
    icon: "fa-solid fa-bag-shopping",
  },
  LIPS: {
    followerLabel: "domains.campaign.followerLabel.follower",
    icon: "fa-solid fa-heart",
  },
  ATCOSME: {
    followerLabel: "domains.campaign.followerLabel.follower",
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
    // 단순 리뷰는 서브타입 선택 = 필수 응모. 모집 인원은 캠페인 단위로 공통 적용.
    return {
      subType,
      minFollowers: 0,
      recruitCount: 1,
      rewardJpy: null,
      subTypeOptions: [],
      options: [],
      insightRequired: false,
      isRequired: true,
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
  const t = useT();
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
      const created = createRecruit(category, subType);
      // 단순 리뷰는 모집 인원이 캠페인 공통 — 새 서브타입도 기존 값을 물려받는다.
      const sharedCount = value[0]?.recruitCount;
      if (category === "SIMPLE_REVIEW" && sharedCount !== undefined) {
        created.recruitCount = sharedCount;
      }
      onChange([...value, created]);
    }
  };

  // 단순 리뷰 전용: 선택한 전 서브타입에 동일 모집 인원 적용.
  const setSimpleReviewRecruitCount = (count: number) => {
    onChange(value.map((recruit) => ({ ...recruit, recruitCount: count })));
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
        <label className={styles.subLabel}>{t("domains.campaign.recruitList.rewardAmountJpyLabel")}</label>
        <div className={styles.snsCountRow}>
          <input
            type="text"
            inputMode="numeric"
            className={styles.input}
            placeholder={t("domains.campaign.recruitList.rewardPlaceholder")}
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

  const simpleReviewCount = value[0]?.recruitCount;
  const simpleReviewCountText =
    value.length > 0 &&
    simpleReviewCount !== undefined &&
    Number.isFinite(simpleReviewCount)
      ? String(simpleReviewCount)
      : "";
  const simpleReviewCountError =
    value.length > 0 ? errorByIndex?.[0]?.recruitCount : undefined;

  return (
    <div className={styles.snsRecruits}>
      {category === "SIMPLE_REVIEW" && (
        <div className={styles.snsField}>
          <label className={styles.subLabel}>
            {t("domains.campaign.recruitList.sharedRecruitCountLabel")}
          </label>
          <div className={styles.snsCountRow}>
            <input
              type="text"
              inputMode="numeric"
              className={styles.input}
              value={simpleReviewCountText}
              disabled={disabled || value.length === 0}
              onChange={(event) =>
                setSimpleReviewRecruitCount(parseIntegerInput(event.target.value))
              }
            />
            <span className={styles.snsSuffix}>
              {t("domains.campaign.recruitList.personSuffix")}
            </span>
          </div>
          {simpleReviewCountError && (
            <div className={styles.error}>{simpleReviewCountError}</div>
          )}
        </div>
      )}
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
                // 모집 인원은 캠페인 공통 입력으로, 필수 여부는 선택 자체로 갈음.
                // 서브타입별로 남는 건 PER_SUBTYPE 보수뿐.
                rewardType === "PER_SUBTYPE" ? (
                  <div className={styles.snsFields}>
                    {renderRewardField(index, row, errors)}
                  </div>
                ) : null
              ) : category === "SNS" ? (
                <div className={styles.snsFields}>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>
                      {t("domains.campaign.recruitList.minFollowersLabel", {
                        label: t(meta.followerLabel),
                      })}
                    </label>
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
                      <span className={styles.snsSuffix}>
                        {t("domains.application.applicants.minFollowersFilter.suffix")}
                      </span>
                    </div>
                    {errors?.minFollowers && (
                      <div className={styles.error}>{errors.minFollowers}</div>
                    )}
                  </div>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>
                      {t("domains.campaign.recruitList.recruitCountLabel")}
                      {optionAttributeOn(row, "recruitCount") &&
                        t("domains.campaign.recruitList.recruitCountSumSuffix")}
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
                      <span className={styles.snsSuffix}>{t("domains.campaign.recruitList.personSuffix")}</span>
                    </div>
                    {errors?.recruitCount && (
                      <div className={styles.error}>{errors.recruitCount}</div>
                    )}
                  </div>
                  {renderRewardField(index, row, errors)}
                  {subType === "INSTAGRAM" && (
                    <div className={styles.snsField}>
                      <label className={styles.subLabel}>
                        {t("domains.campaign.recruitList.postTypesLabel")}
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
                              checked={row.subTypeOptions.includes(postType)}
                              disabled={disabled}
                              onChange={() => toggleInstagramPostType(index, postType)}
                            />
                            <span className={styles.snsToggleLabel}>
                              {t(INSTAGRAM_POST_TYPE_LABEL[postType])}
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
                      <label className={styles.subLabel}>
                        {t("domains.campaign.recruitList.postTypeDetailLabel")}
                      </label>
                      <div className={styles.snsCountRow}>
                        <label className={styles.snsToggle} style={{ marginRight: 12 }}>
                          <input
                            type="checkbox"
                            checked={optionAttributeOn(row, "recruitCount")}
                            disabled={disabled}
                            onChange={() => toggleOptionAttribute(index, "recruitCount")}
                          />
                          <span className={styles.snsToggleLabel}>
                            {t("domains.campaign.recruitList.perTypeCount")}
                          </span>
                        </label>
                        {rewardType === "PER_SUBTYPE" && (
                          <label className={styles.snsToggle}>
                            <input
                              type="checkbox"
                              checked={optionAttributeOn(row, "rewardJpy")}
                              disabled={disabled}
                              onChange={() => toggleOptionAttribute(index, "rewardJpy")}
                            />
                            <span className={styles.snsToggleLabel}>
                              {t("domains.campaign.recruitList.perTypeReward")}
                            </span>
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
                            {optionRow.option in INSTAGRAM_POST_TYPE_LABEL
                              ? t(
                                  INSTAGRAM_POST_TYPE_LABEL[
                                    optionRow.option as InstagramPostType
                                  ],
                                )
                              : optionRow.option}
                          </span>
                          {optionAttributeOn(row, "recruitCount") && (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                className={styles.input}
                                style={{ maxWidth: 90 }}
                                placeholder={t("domains.campaign.recruitList.countPlaceholder")}
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
                              <span className={styles.snsSuffix}>{t("domains.campaign.recruitList.personSuffix")}</span>
                            </>
                          )}
                          {optionAttributeOn(row, "rewardJpy") && (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                className={styles.input}
                                style={{ maxWidth: 110 }}
                                placeholder={t(
                                  "domains.campaign.recruitList.rewardShortPlaceholder",
                                )}
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
                      <span className={styles.snsToggleLabel}>
                        {t("domains.campaign.recruitList.insightRequired")}
                      </span>
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
                        {t("domains.campaign.recruitList.applyRequired")}
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className={styles.snsFields}>
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>
                      {t("domains.campaign.recruitList.recruitCountLabel")}
                    </label>
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
                      <span className={styles.snsSuffix}>{t("domains.campaign.recruitList.personSuffix")}</span>
                    </div>
                    {errors?.recruitCount && (
                      <div className={styles.error}>{errors.recruitCount}</div>
                    )}
                  </div>
                  {renderRewardField(index, row, errors)}
                  <div className={styles.snsField}>
                    <label className={styles.subLabel}>
                      {t("domains.campaign.recruitList.productPriceLabel")}
                    </label>
                    <div className={styles.snsCountRow}>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={styles.input}
                        placeholder={t("domains.campaign.recruitList.productPricePlaceholder")}
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
                    <label className={styles.subLabel}>
                      {t("domains.campaign.recruitList.productUrlLabel")}
                    </label>
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
                      <label className={styles.subLabel}>
                        {t("domains.campaign.recruitList.reviewChannelLabel")}
                      </label>
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
