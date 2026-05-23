import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getCampaign } from "../../lib/api/campaigns";
import { createApplication } from "../../lib/api/applications";
import { fetchMe } from "../../lib/api/auth";
import { PageHeader } from "../../components/layout/PageHeader";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { ErrorBanner } from "../../components/form/ErrorBanner";
import "./Apply.css";

const CONFIRM_KEYS = ["PR_LABEL", "DEADLINE", "INSIGHTS", "YAKKIHO", "GUIDELINE"] as const;
const CONFIRM_LABELS: Record<(typeof CONFIRM_KEYS)[number], string> = {
  PR_LABEL: "投稿冒頭に「#PR」または「ブランドから提供」表記",
  DEADLINE: "受取後2週間以内に投稿",
  INSIGHTS: "投稿7日後にインサイト提出",
  YAKKIHO: "薬機法の遵守",
  GUIDELINE: "ガイドラインの確認・遵守",
};

export function Apply() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const campaign = useQuery({
    queryKey: ["influencer-campaign", id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
  });
  const me = useQuery({ queryKey: ["me"], queryFn: fetchMe });

  const allAgreed = CONFIRM_KEYS.every((k) => agreed.has(k));

  const apply = useMutation({
    mutationFn: () => createApplication(id),
    onSuccess: (app) => nav(`/applications/${app.id}`, { replace: true }),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? "応募に失敗しました");
    },
  });

  function toggle(k: string) {
    setAgreed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
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

  const mySnsTypes = new Set(me.data?.snsAccounts.map((s) => s.snsType) ?? []);
  const matched = campaign.data.snsRecruits
    .map((r) => r.snsType)
    .filter((t) => mySnsTypes.has(t));

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
          <h3>応募に使用されるSNS</h3>
          {matched.length === 0 ? (
            <p style={{ color: "#ef4444", fontSize: 13 }}>
              対象SNSのアカウントが未登録です
            </p>
          ) : (
            <ul className="apply__sns">
              {matched.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="apply__sec">
          <h3>応募にあたっての再確認</h3>
          {CONFIRM_KEYS.map((k) => (
            <label key={k} className="apply__chk">
              <input
                type="checkbox"
                checked={agreed.has(k)}
                onChange={() => toggle(k)}
              />
              <span>{CONFIRM_LABELS[k]}</span>
            </label>
          ))}
        </section>

        {error && <ErrorBanner message={error} />}
      </div>

      <div className="apply__cta">
        <PrimaryButton
          disabled={!allAgreed || matched.length === 0 || apply.isPending}
          onClick={() => apply.mutate()}
        >
          {apply.isPending ? "送信中…" : "応募を送信"}
        </PrimaryButton>
      </div>
    </div>
  );
}
