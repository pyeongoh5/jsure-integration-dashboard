import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { SnsType } from "@jsure/shared";
import { getCampaign } from "../../lib/api/campaigns";
import { PageHeader } from "../../components/layout/PageHeader";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import "./CampaignDetail.css";

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

const SNS_LABEL: Record<SnsType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

function formatYen(v: number) {
  return `¥${v.toLocaleString("ja-JP")}`;
}

function formatDate(iso: string) {
  return iso.slice(0, 10);
}

export function CampaignDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["influencer-campaign", id],
    queryFn: () => getCampaign(id),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div className="cdetail__loading">読み込み中…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className="cdetail__empty">読み込みに失敗しました</div>
      </div>
    );
  }

  const closed =
    data.isEnded ||
    new Date(data.recruitEndAt) < new Date() ||
    data.appliedCount >= data.recruitCount;

  return (
    <div className="cdetail">
      <PageHeader showBack title={data.title} />
      <div
        className="cdetail__hero"
        style={
          data.thumbnailUrl
            ? { backgroundImage: `url(${data.thumbnailUrl})` }
            : undefined
        }
      />

      <div className="cdetail__body">
        <div className="cdetail__head">
          <h1 className="cdetail__title">{data.title}</h1>
          <div className="cdetail__reward">{formatYen(data.rewardJpy)}</div>
        </div>
        <div className="cdetail__period">
          募集 {formatDate(data.recruitStartAt)} 〜 {formatDate(data.recruitEndAt)}
        </div>

        <ul className="cdetail__sns">
          {data.snsRecruits.map((r) => (
            <li key={r.snsType} className={`cdetail__sns-row cdetail__sns-row--${r.snsType.toLowerCase()}`}>
              <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
              <span className="cdetail__sns-name">{SNS_LABEL[r.snsType]}</span>
              <span className="cdetail__sns-count">募集 {r.recruitCount}名</span>
              <span className="cdetail__sns-cond">
                条件:{" "}
                {r.minFollowers > 0
                  ? `${r.snsType === "YOUTUBE" ? "登録者" : "フォロワー"}数 ${r.minFollowers.toLocaleString("ja-JP")}+`
                  : "制限なし"}
              </span>
            </li>
          ))}
        </ul>

        <section className="cdetail__section">
          <h3>商品</h3>
          <div
            className="cdetail__rich"
            dangerouslySetInnerHTML={{ __html: data.productSummary }}
          />
          <a
            href={data.productDetailUrl}
            target="_blank"
            rel="noreferrer"
            className="cdetail__link"
          >
            商品ページを見る →
          </a>
        </section>

        <section className="cdetail__section">
          <h3>ガイドライン</h3>
          <div
            className="cdetail__rich"
            dangerouslySetInnerHTML={{ __html: data.guideline }}
          />
          {data.referenceMediaUrls.length > 0 && (
            <ul className="cdetail__refs">
              {data.referenceMediaUrls.map((u) => (
                <li key={u}>
                  <a href={u} target="_blank" rel="noreferrer">
                    {u}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cdetail__section">
          <h3>注意事項</h3>
          <div
            className="cdetail__rich"
            dangerouslySetInnerHTML={{ __html: data.cautions }}
          />
        </section>
      </div>

      <div className="cdetail__cta">
        {data.appliedSnsTypes.length > 0 && (
          <PrimaryButton onClick={() => nav("/applications")}>
            応募内訳を見る
          </PrimaryButton>
        )}
        {data.appliedSnsTypes.length < data.snsRecruits.length && (
          <PrimaryButton
            disabled={closed}
            onClick={() => nav(`/campaigns/${data.id}/apply`)}
          >
            {closed
              ? "募集終了"
              : data.appliedSnsTypes.length > 0
                ? "別のSNSで応募する"
                : "応募する"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
