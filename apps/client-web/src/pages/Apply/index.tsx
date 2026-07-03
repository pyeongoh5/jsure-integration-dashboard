import { useMemo, useState } from "react";
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

const CONFIRM_KEYS = [
  "PR_LABEL",
  "DEADLINE",
  "INSIGHTS",
  "YAKKIHO",
  "GUIDELINE",
] as const;
const CONFIRM_LABELS: Record<(typeof CONFIRM_KEYS)[number], string> = {
  PR_LABEL: t("pages.apply.confirmPr"),
  DEADLINE: t("pages.apply.confirmDeadline"),
  INSIGHTS: t("pages.apply.confirmInsights"),
  YAKKIHO: t("pages.apply.confirmYakkiho"),
  GUIDELINE: t("pages.apply.confirmGuideline"),
};

const SNS_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
  QOO10: "Qoo10",
  LIPS: "LIPS",
  ATCOSME: "@cosme",
};

const SNS_FOLLOWER_LABEL: Record<CampaignSubType, string> = {
  INSTAGRAM: t("pages.apply.snsFollower"),
  TIKTOK: t("pages.apply.snsFollower"),
  X: t("pages.apply.snsFollower"),
  YOUTUBE: t("pages.apply.snsSubscriber"),
  QOO10: t("pages.apply.snsFollower"),
  LIPS: t("pages.apply.snsFollower"),
  ATCOSME: t("pages.apply.snsFollower"),
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

  const qualifying = useMemo(() => {
    if (!campaign.data || !me.data) return [];
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

  const allAgreed = CONFIRM_KEYS.every((k) => agreed.has(k));
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
    return instagramRecruit?.instagramPostTypes ?? [];
  }, [campaign.data]);
  const instagramPostTypeMissing = wantsInstagram && !instagramPostType;

  const apply = useMutation({
    mutationFn: () =>
      createApplication(
        id,
        Array.from(selectedSns),
        wantsInstagram ? instagramPostType : null,
      ),
    onSuccess: (app) => nav(`/applications/${app.id}`, { replace: true }),
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
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

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

        <section className={styles.sec}>
          <h3>{t("pages.apply.confirmSectionTitle")}</h3>
          {CONFIRM_KEYS.map((k) => (
            <label key={k} className={styles.chk}>
              <input
                type="checkbox"
                checked={agreed.has(k)}
                onChange={() => toggleAgree(k)}
              />
              <span>{CONFIRM_LABELS[k]}</span>
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
            !me.data?.address ||
            !addressConfirmed ||
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
