import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { InstagramPostType, CampaignSubType } from "@jsure/shared";
import { useCampaign } from "@/domains/campaign";
import { createApplication } from "@/domains/application";
import { fetchMe } from "@/domains/auth";
import { t } from "@i18n";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import styles from "./Apply.module.css";

const CONFIRM_KEYS_SNS = [
  "PR_LABEL",
  "DEADLINE",
  "INSIGHTS",
  "YAKKIHO",
  "GUIDELINE",
] as const;
const CONFIRM_KEYS_FAKE_PURCHASE = [
  "PR_LABEL",
  "DEADLINE",
  "YAKKIHO",
  "GUIDELINE",
] as const;
type ConfirmKey = (typeof CONFIRM_KEYS_SNS)[number];

// DEADLINE 은 캠페인의 postingPeriodDays 를 삽입해서 동적으로 노출한다. // new
function confirmLabel(key: ConfirmKey, postingPeriodDays: number): string { // new
  switch (key) {
    case "PR_LABEL":
      return t("pages.apply.confirmPr");
    case "DEADLINE":
      return `${t("pages.apply.confirmDeadlinePrefix")}${postingPeriodDays}${t("pages.apply.confirmDeadlineSuffix")}`;
    case "INSIGHTS":
      return t("pages.apply.confirmInsights");
    case "YAKKIHO":
      return t("pages.apply.confirmYakkiho");
    case "GUIDELINE":
      return t("pages.apply.confirmGuideline");
  }
}

const FAKE_PURCHASE_SUB_TYPES: readonly CampaignSubType[] = ["QOO10"];

function isFakePurchaseSubType(subType: CampaignSubType): boolean {
  return FAKE_PURCHASE_SUB_TYPES.includes(subType);
}

const SNS_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS", // new
  ATCOSME: "@cosme", // new
};

const SNS_FOLLOWER_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: t("pages.apply.snsFollower"),
  TIKTOK: t("pages.apply.snsFollower"),
  X: t("pages.apply.snsFollower"),
  YOUTUBE: t("pages.apply.snsSubscriber"),
  QOO10: t("pages.apply.snsFollower"),
  LIPS: t("pages.apply.snsFollower"), // new
  ATCOSME: t("pages.apply.snsFollower"), // new
};

const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: t("pages.apply.instagramFeed"),
  REELS: t("pages.apply.instagramReels"),
};

export function Apply() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [selectedSns, setSelectedSns] = useState<Set<CampaignSubType>>(new Set());
  const [instagramPostType, setInstagramPostType] =
    useState<InstagramPostType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const campaign = useCampaign(id);
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const isFakePurchaseCampaign = campaign.data?.category === "FAKE_PURCHASE";
  const isSimpleReviewCampaign = campaign.data?.category === "SIMPLE_REVIEW"; // new
  const activeConfirmKeys: readonly ConfirmKey[] =
    isFakePurchaseCampaign || isSimpleReviewCampaign // new
      ? CONFIRM_KEYS_FAKE_PURCHASE
      : CONFIRM_KEYS_SNS;

  // 가구매 캠페인은 서브타입이 QOO10 하나뿐이므로 자동 선택
  useEffect(() => {
    if (!campaign.data) return;
    if (campaign.data.category !== "FAKE_PURCHASE") return;
    setSelectedSns((prev) => {
      if (prev.has("QOO10")) return prev;
      const next = new Set(prev);
      next.add("QOO10");
      return next;
    });
  }, [campaign.data]);

  // 단순 리뷰 캠페인은 배송·팔로워 조건이 없으므로 캠페인이 모집하는 모든 서브타입을 자동 선택. // new
  useEffect(() => {
    if (!campaign.data) return;
    if (campaign.data.category !== "SIMPLE_REVIEW") return;
    const recruitSubTypes = campaign.data.recruits.map((r) => r.subType);
    setSelectedSns((prev) => {
      const next = new Set(prev);
      let mutated = false;
      for (const subType of recruitSubTypes) {
        if (!next.has(subType)) {
          next.add(subType);
          mutated = true;
        }
      }
      return mutated ? next : prev;
    });
  }, [campaign.data]);

  const qualifying = useMemo(() => {
    if (!campaign.data || !me.data) return [];
    if (
      campaign.data.category === "FAKE_PURCHASE" ||
      campaign.data.category === "SIMPLE_REVIEW" // new
    ) {
      return campaign.data.recruits.map((r) => r.subType);
    }
    const followerByMySns = new Map(
      me.data.snsAccounts.map((a) => [a.snsType, a.followerCount]),
    );
    return campaign.data.recruits
      .filter((r) => {
        const follower = (followerByMySns as Map<CampaignSubType, number>).get(
          r.subType,
        );
        return follower !== undefined && follower >= r.minFollowers;
      })
      .map((r) => r.subType);
  }, [campaign.data, me.data]);

  const allAgreed = activeConfirmKeys.every((k) => agreed.has(k));
  const hasSelection = selectedSns.size > 0;
  const isClosed = Boolean(
    campaign.data &&
      (campaign.data.isEnded ||
        new Date(campaign.data.recruitEndAt) < new Date() ||
        campaign.data.appliedCount >= campaign.data.recruitCount),
  );

  const wantsInstagram = selectedSns.has("INSTAGRAM");
  const allowedInstagramPostTypes = useMemo<InstagramPostType[]>(() => {
    if (!campaign.data) return [];
    const instagramRecruit = campaign.data.recruits.find(
      (recruit) => recruit.subType === "INSTAGRAM",
    );
    const options = instagramRecruit?.subTypeOptions ?? [];
    const allowed: InstagramPostType[] = [];
    for (const option of options) {
      if (option === "FEED" || option === "REELS") allowed.push(option);
    }
    return allowed;
  }, [campaign.data]);
  const instagramPostTypeMissing = wantsInstagram && !instagramPostType;

  const apply = useMutation({
    mutationFn: () =>
      createApplication(
        id,
        Array.from(selectedSns),
        wantsInstagram ? instagramPostType : null,
      ),
    onSuccess: () => nav("/applications", { replace: true }),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? t("pages.apply.errorFallback"));
    },
  });

  function toggleAgree(k: string) {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function toggleSns(s: CampaignSubType) {
    setSelectedSns((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
    if (s === "INSTAGRAM") {
      setInstagramPostType(null);
    }
  }

  if (campaign.isLoading || me.isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
          {t("pages.apply.loading")}
        </div>
      </div>
    );
  }
  if (!campaign.data) {
    return (
      <div>
        <PageHeader showBack />
        <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
          {t("pages.apply.notFound")}
        </div>
      </div>
    );
  }

  const followerByMySns = new Map(
    me.data?.snsAccounts.map((a) => [a.snsType, a.followerCount]) ?? [],
  );

  return (
    <div className={styles.apply}>
      <PageHeader showBack title={t("pages.apply.title")} />
      <div className={styles.body}>
        <div className={styles.cam}>
          <div className={styles.camTitle}>{campaign.data.title}</div>
          <div className={styles.camReward}>
            ¥{campaign.data.rewardJpy.toLocaleString("ja-JP")}
          </div>
        </div>

        {isFakePurchaseCampaign ? (
          <section className={styles.sec}>
            <h3>{t("pages.apply.fakePurchaseSectionTitle")}</h3>
            {campaign.data.recruits.map((r) => (
              <div key={r.subType} className={styles.snsCond}>
                {t("campaign.detail.productPrice")}: ¥
                {(r.productPriceJpy ?? 0).toLocaleString("ja-JP")}
              </div>
            ))}
          </section>
        ) : isSimpleReviewCampaign ? null : ( // new
        <section className={styles.sec}>
          <h3>{t("pages.apply.snsSectionTitle")}</h3>
          {qualifying.length === 0 ? (
            <p style={{ color: "#ef4444", fontSize: 13 }}>
              {t("pages.apply.noQualifying")}
            </p>
          ) : (
            <ul className={styles.snsPick}>
              {campaign.data.recruits.map((r) => {
                const isQualifying = qualifying.includes(r.subType);
                const isCancelled = campaign.data.cancelledSubTypes.includes(
                  r.subType,
                );
                const alreadyApplied =
                  !isCancelled &&
                  campaign.data.appliedSubTypes.includes(r.subType);
                const isExcluded = campaign.data.excludedSubTypes.includes(
                  r.subType,
                );
                const myFollowers = (
                  followerByMySns as Map<CampaignSubType, number>
                ).get(r.subType);
                const isSelected = selectedSns.has(r.subType);
                const disabled =
                  !isQualifying || alreadyApplied || isCancelled || isExcluded;
                return (
                  <li key={r.subType}>
                    <label
                      className={`${styles.snsItem} ${
                        disabled ? styles.snsItemDisabled : ""
                      } ${isSelected ? styles.snsItemSelected : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggleSns(r.subType)}
                      />
                      <div className={styles.snsInfo}>
                        <div className={styles.snsName}>
                          {SNS_LABEL[r.subType]}
                          {alreadyApplied && (
                            <span style={{ marginLeft: 8, color: "#10b981", fontSize: 11 }}>
                              {t("pages.apply.appliedTag")}
                            </span>
                          )}
                          {isCancelled && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              {t("pages.apply.cancelledTag")}
                            </span>
                          )}
                          {!alreadyApplied && !isCancelled && isExcluded && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              {t("pages.apply.excludedTag")}
                            </span>
                          )}
                        </div>
                        {isFakePurchaseSubType(r.subType) ? (
                          <div className={styles.snsCond}>
                            {t("campaign.detail.productPrice")}: ¥
                            {(r.productPriceJpy ?? 0).toLocaleString("ja-JP")}
                          </div>
                        ) : (
                          <div className={styles.snsCond}>
                            {t("pages.apply.condPrefix")}{SNS_FOLLOWER_LABEL[r.subType]}{" "}
                            {r.minFollowers > 0
                              ? `${r.minFollowers.toLocaleString("ja-JP")}${t("pages.apply.followerMinSuffix")}`
                              : t("pages.apply.noLimit")}
                            {myFollowers !== undefined && (
                              <>
                                {t("pages.apply.currentPrefix")}
                                {myFollowers.toLocaleString("ja-JP")}
                                {t("pages.apply.currentSuffix")}
                              </>
                            )}
                            {myFollowers === undefined && (
                              <>{t("pages.apply.notRegistered")}</>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}

        {wantsInstagram && allowedInstagramPostTypes.length > 0 && (
          <section className={styles.sec}>
            <h3>{t("pages.apply.instagramPostTypeTitle")}</h3>
            <ul className={styles.snsPick}>
              {allowedInstagramPostTypes.map((postType) => {
                const isSelected = instagramPostType === postType;
                return (
                  <li key={postType}>
                    <label
                      className={`${styles.snsItem} ${
                        isSelected ? styles.snsItemSelected : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="instagram-post-type"
                        checked={isSelected}
                        onChange={() => setInstagramPostType(postType)}
                      />
                      <div className={styles.snsInfo}>
                        <div className={styles.snsName}>
                          {INSTAGRAM_POST_TYPE_LABEL[postType]}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {instagramPostTypeMissing && (
              <p style={{ color: "#ef4444", fontSize: 13 }}>
                {t("pages.apply.selectPostType")}
              </p>
            )}
          </section>
        )}

        {!isFakePurchaseCampaign && ( // new — SNS/단순 리뷰: 배송이 있으므로 주소 확인 노출
          <section className={styles.sec}>
            <h3>{t("pages.apply.addressTitle")}</h3>
            {me.data?.address ? (
              <>
                <div className={styles.address}>
                  〒{me.data.address.postalCode}
                  <br />
                  {me.data.address.prefecture}
                  {me.data.address.city}
                  {me.data.address.addressLine1}
                  {me.data.address.addressLine2
                    ? ` ${me.data.address.addressLine2}`
                    : ""}
                </div>
                <label className={styles.chk}>
                  <input
                    type="checkbox"
                    checked={addressConfirmed}
                    onChange={() => setAddressConfirmed((prev) => !prev)}
                  />
                  <span>{t("pages.apply.confirmAddress")}</span>
                </label>
                <button
                  type="button"
                  className={styles.addressEdit}
                  onClick={() => nav("/me/address")}
                >
                  {t("pages.apply.editAddress")}
                </button>
                <p className={styles.addressNotice}>
                  {t("pages.apply.addressNotice")}
                </p>
                <p className={`${styles.addressNotice} ${styles.addressNoticeCaution}`}>
                  {t("pages.apply.addressCaution")}
                </p>
              </>
            ) : (
              <div className={`${styles.address} ${styles.addressMissing}`}>
                {t("pages.apply.addressMissing")}
                <button
                  type="button"
                  className={styles.addressEdit}
                  onClick={() => nav("/me/address")}
                >
                  {t("pages.apply.registerAddress")}
                </button>
              </div>
            )}
          </section>
        )}

        <section className={styles.sec}>
          <h3>{t("pages.apply.confirmSectionTitle")}</h3>
          {activeConfirmKeys.map((k) => (
            <label key={k} className={styles.chk}>
              <input
                type="checkbox"
                checked={agreed.has(k)}
                onChange={() => toggleAgree(k)}
              />
              <span>{confirmLabel(k, campaign.data.postingPeriodDays)}</span> {/* new */}
            </label>
          ))}
        </section>

        {error && <ErrorBanner message={error} />}
      </div>

      <div className={styles.cta}>
        <PrimaryButton
          disabled={
            isClosed ||
            !allAgreed ||
            !hasSelection ||
            instagramPostTypeMissing ||
            qualifying.length === 0 ||
            (!isFakePurchaseCampaign && (!me.data?.address || !addressConfirmed)) || // new
            apply.isPending
          }
          onClick={() => apply.mutate()}
        >
          {isClosed
            ? t("pages.apply.ctaClosed")
            : apply.isPending
              ? t("pages.apply.ctaSubmitting")
              : t("pages.apply.ctaSubmit")}
        </PrimaryButton>
      </div>
    </div>
  );
}
