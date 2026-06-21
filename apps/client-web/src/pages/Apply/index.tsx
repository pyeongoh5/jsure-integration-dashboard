import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { InstagramPostType, SnsType } from "@jsure/shared";
import { useCampaign } from "@/domains/campaign";
import { createApplication } from "@/domains/application";
import { fetchMe } from "@/domains/auth";
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
  PR_LABEL: "投稿冒頭に「#PR」または「ブランドから提供」表記",
  DEADLINE: "受取後2週間以内に投稿",
  INSIGHTS: "投稿7日後にインサイト提出",
  YAKKIHO: "薬機法の遵守",
  GUIDELINE: "ガイドラインの確認・遵守",
};

const SNS_LABEL: Record<SnsType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  X: "X",
  YOUTUBE: "YouTube",
};

const SNS_FOLLOWER_LABEL: Record<SnsType, string> = {
  INSTAGRAM: "フォロワー",
  TIKTOK: "フォロワー",
  X: "フォロワー",
  YOUTUBE: "登録者",
};

const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: "フィード",
  REELS: "リール",
};

export function Apply() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [selectedSns, setSelectedSns] = useState<Set<SnsType>>(new Set());
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
    return campaign.data.snsRecruits
      .filter((r) => {
        const f = followerByMySns.get(r.snsType);
        return f !== undefined && f >= r.minFollowers;
      })
      .map((r) => r.snsType);
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
    const instagramRecruit = campaign.data.snsRecruits.find(
      (recruit) => recruit.snsType === "INSTAGRAM",
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
      setError(e?.response?.data?.message ?? "応募に失敗しました");
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

  function toggleSns(s: SnsType) {
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
          読み込み中…
        </div>
      </div>
    );
  }
  if (!campaign.data) {
    return (
      <div>
        <PageHeader showBack />
        <div style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>
          キャンペーンが見つかりません
        </div>
      </div>
    );
  }

  const followerByMySns = new Map(
    me.data?.snsAccounts.map((a) => [a.snsType, a.followerCount]) ?? [],
  );

  return (
    <div className={styles.apply}>
      <PageHeader showBack title="応募確認" />
      <div className={styles.body}>
        <div className={styles.cam}>
          <div className={styles.camTitle}>{campaign.data.title}</div>
          <div className={styles.camReward}>
            ¥{campaign.data.rewardJpy.toLocaleString("ja-JP")}
          </div>
        </div>

        <section className={styles.sec}>
          <h3>応募に使用するSNSを選択</h3>
          {qualifying.length === 0 ? (
            <p style={{ color: "#ef4444", fontSize: 13 }}>
              応募条件を満たすSNSアカウントがありません
            </p>
          ) : (
            <ul className={styles.snsPick}>
              {campaign.data.snsRecruits.map((r) => {
                const isQualifying = qualifying.includes(r.snsType);
                const isCancelled = campaign.data.cancelledSnsTypes.includes(
                  r.snsType,
                );
                const alreadyApplied =
                  !isCancelled &&
                  campaign.data.appliedSnsTypes.includes(r.snsType);
                const isExcluded = campaign.data.excludedSnsTypes.includes(
                  r.snsType,
                );
                const myFollowers = followerByMySns.get(r.snsType);
                const isSelected = selectedSns.has(r.snsType);
                const disabled =
                  !isQualifying || alreadyApplied || isCancelled || isExcluded;
                return (
                  <li key={r.snsType}>
                    <label
                      className={`${styles.snsItem} ${
                        disabled ? styles.snsItemDisabled : ""
                      } ${isSelected ? styles.snsItemSelected : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggleSns(r.snsType)}
                      />
                      <div className={styles.snsInfo}>
                        <div className={styles.snsName}>
                          {SNS_LABEL[r.snsType]}
                          {alreadyApplied && (
                            <span style={{ marginLeft: 8, color: "#10b981", fontSize: 11 }}>
                              応募済み
                            </span>
                          )}
                          {isCancelled && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              応募キャンセル済（再応募不可）
                            </span>
                          )}
                          {!alreadyApplied && !isCancelled && isExcluded && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              参加不可（類似キャンペーンに応募済み）
                            </span>
                          )}
                        </div>
                        <div className={styles.snsCond}>
                          応募条件: {SNS_FOLLOWER_LABEL[r.snsType]}{" "}
                          {r.minFollowers > 0
                            ? `${r.minFollowers.toLocaleString("ja-JP")}人以上`
                            : "制限なし"}
                          {myFollowers !== undefined && (
                            <>
                              {" "}
                              （現在: {myFollowers.toLocaleString("ja-JP")}人）
                            </>
                          )}
                          {myFollowers === undefined && (
                            <>（アカウント未登録）</>
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
            <h3>Instagram 投稿タイプ</h3>
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
                投稿タイプを選択してください
              </p>
            )}
          </section>
        )}

        <section className={styles.sec}>
          <h3>お届け先住所</h3>
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
                <span>この住所で受け取ります</span>
              </label>
              <button
                type="button"
                className={styles.addressEdit}
                onClick={() => nav("/me/address")}
              >
                住所を修正する
              </button>
              <p className={styles.addressNotice}>
                上記の内容に変更がある場合は、マイページで更新のうえ、再度ご応募ください。
              </p>
              <p className={`${styles.addressNotice} ${styles.addressNoticeCaution}`}>
                ※住所の転送手続きを行う場合、転送費用をご負担いただくことがございますので、あらかじめご了承ください。
              </p>
            </>
          ) : (
            <div className={`${styles.address} ${styles.addressMissing}`}>
              お届け先住所が未登録です。
              <button
                type="button"
                className={styles.addressEdit}
                onClick={() => nav("/me/address")}
              >
                住所を登録する
              </button>
            </div>
          )}
        </section>

        <section className={styles.sec}>
          <h3>応募にあたっての再確認</h3>
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
            ? "募集終了"
            : apply.isPending
              ? "送信中…"
              : "応募を送信"}
        </PrimaryButton>
      </div>
    </div>
  );
}
