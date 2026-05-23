import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getCampaign } from "../../lib/api/campaigns";
import { PageHeader } from "../../components/layout/PageHeader";
import { PrimaryButton } from "../../components/form/PrimaryButton";
import { SnsBadgeList } from "../../components/Campaign/SnsBadgeList";
import "./CampaignDetail.css";

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
    new Date(data.recruitEndAt) < new Date() ||
    data.appliedCount >= data.recruitCount;

  return (
    <div className="cdetail">
      <PageHeader showBack title={data.brandName ?? data.title} />
      <div
        className="cdetail__hero"
        style={
          data.thumbnailUrl
            ? { backgroundImage: `url(${data.thumbnailUrl})` }
            : undefined
        }
      >
        {data.brandTagline && (
          <div className="cdetail__hero-tagline">{data.brandTagline}</div>
        )}
        {data.brandName && (
          <div className="cdetail__hero-brand">{data.brandName}</div>
        )}
      </div>

      <div className="cdetail__body">
        <h1 className="cdetail__title">{data.title}</h1>
        <div className="cdetail__reward">{formatYen(data.rewardJpy)}</div>
        <div className="cdetail__period">
          募集 {formatDate(data.recruitStartAt)} 〜 {formatDate(data.recruitEndAt)}
        </div>

        <SnsBadgeList snsTypes={data.snsTypes} minFollowers={data.minFollowers} />

        <section className="cdetail__section">
          <h3>商品</h3>
          <p>{data.productSummary}</p>
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
          <h3>SNS別募集</h3>
          <ul className="cdetail__rlist">
            {data.snsRecruits.map((r) => (
              <li key={r.snsType}>
                <b>{r.snsType}</b>
                <span>{r.recruitCount}名</span>
                {r.condition && <p>{r.condition}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="cdetail__section">
          <h3>ガイドライン</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{data.guideline}</p>
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
          <p style={{ whiteSpace: "pre-wrap" }}>{data.cautions}</p>
        </section>
      </div>

      <div className="cdetail__cta">
        {data.hasApplied ? (
          <PrimaryButton onClick={() => nav("/applications")}>
            応募内訳を見る
          </PrimaryButton>
        ) : (
          <PrimaryButton
            disabled={closed}
            onClick={() => nav(`/campaigns/${data.id}/apply`)}
          >
            {closed ? "募集終了" : "応募する"}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
