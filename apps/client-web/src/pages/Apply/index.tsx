import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { SnsType } from "@jsure/shared";
import { getCampaign } from "../../lib/api/campaigns";
import { createApplication } from "../../lib/api/applications";
import { fetchMe } from "../../lib/api/auth";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { ErrorBanner } from "../../components/composites/ErrorBanner";
import "./Apply.css";

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

export function Apply() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [selectedSns, setSelectedSns] = useState<Set<SnsType>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addressConfirmed, setAddressConfirmed] = useState(false);

  const campaign = useQuery({
    queryKey: ["influencer-campaign", id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
  });
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

  const apply = useMutation({
    mutationFn: () => createApplication(id, Array.from(selectedSns)),
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
    <div className="apply">
      <PageHeader showBack title="応募確認" />
      <div className="apply__body">
        <div className="apply__cam">
          <div className="apply__cam-title">{campaign.data.title}</div>
          <div className="apply__cam-reward">
            ¥{campaign.data.rewardJpy.toLocaleString("ja-JP")}
          </div>
        </div>

        <section className="apply__sec">
          <h3>応募に使用するSNSを選択</h3>
          {qualifying.length === 0 ? (
            <p style={{ color: "#ef4444", fontSize: 13 }}>
              応募条件を満たすSNSアカウントがありません
            </p>
          ) : (
            <ul className="apply__sns-pick">
              {campaign.data.snsRecruits.map((r) => {
                const isQualifying = qualifying.includes(r.snsType);
                const alreadyApplied = campaign.data.appliedSnsTypes.includes(
                  r.snsType,
                );
                const isExcluded = campaign.data.excludedSnsTypes.includes(
                  r.snsType,
                );
                const myFollowers = followerByMySns.get(r.snsType);
                const isSelected = selectedSns.has(r.snsType);
                const disabled = !isQualifying || alreadyApplied || isExcluded;
                return (
                  <li key={r.snsType}>
                    <label
                      className={`apply__sns-item ${
                        disabled ? "apply__sns-item--disabled" : ""
                      } ${isSelected ? "apply__sns-item--selected" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={disabled}
                        onChange={() => toggleSns(r.snsType)}
                      />
                      <div className="apply__sns-info">
                        <div className="apply__sns-name">
                          {SNS_LABEL[r.snsType]}
                          {alreadyApplied && (
                            <span style={{ marginLeft: 8, color: "#10b981", fontSize: 11 }}>
                              応募済み
                            </span>
                          )}
                          {!alreadyApplied && isExcluded && (
                            <span style={{ marginLeft: 8, color: "#ef4444", fontSize: 11 }}>
                              参加不可（類似キャンペーンに応募済み）
                            </span>
                          )}
                        </div>
                        <div className="apply__sns-cond">
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

        <section className="apply__sec">
          <h3>お届け先住所</h3>
          {me.data?.address ? (
            <>
              <div className="apply__address">
                〒{me.data.address.postalCode}
                <br />
                {me.data.address.prefecture}
                {me.data.address.city}
                {me.data.address.addressLine1}
                {me.data.address.addressLine2
                  ? ` ${me.data.address.addressLine2}`
                  : ""}
              </div>
              <label className="apply__chk">
                <input
                  type="checkbox"
                  checked={addressConfirmed}
                  onChange={() => setAddressConfirmed((prev) => !prev)}
                />
                <span>この住所で受け取ります</span>
              </label>
              <button
                type="button"
                className="apply__address-edit"
                onClick={() => nav("/me/address")}
              >
                住所を修正する
              </button>
              <p className="apply__address-notice">
                上記の内容に変更がある場合は、マイページで更新のうえ、再度ご応募ください。
              </p>
              <p className="apply__address-notice apply__address-notice--caution">
                ※住所の転送手続きを行う場合、転送費用をご負担いただくことがございますので、あらかじめご了承ください。
              </p>
            </>
          ) : (
            <div className="apply__address apply__address--missing">
              お届け先住所が未登録です。
              <button
                type="button"
                className="apply__address-edit"
                onClick={() => nav("/me/address")}
              >
                住所を登録する
              </button>
            </div>
          )}
        </section>

        <section className="apply__sec">
          <h3>応募にあたっての再確認</h3>
          {CONFIRM_KEYS.map((k) => (
            <label key={k} className="apply__chk">
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

      <div className="apply__cta">
        <PrimaryButton
          disabled={
            isClosed ||
            !allAgreed ||
            !hasSelection ||
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
