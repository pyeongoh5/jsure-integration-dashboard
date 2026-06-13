import { useNavigate, useParams } from "react-router-dom";
import type { SnsType, SnsRecruit } from "@jsure/shared";
import { useCampaign, formatYen, formatDate } from "@/domains/campaign";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import styles from "./CampaignDetail.module.css";

const SNS_ROW_CLASS: Record<SnsType, string | undefined> = {
  INSTAGRAM: styles.snsRowInstagram,
  TIKTOK: styles.snsRowTiktok,
  X: styles.snsRowX,
  YOUTUBE: styles.snsRowYoutube,
};

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

export function CampaignDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useCampaign(id);

  if (isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.loading}>読み込み中…</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.empty}>読み込みに失敗しました</div>
      </div>
    );
  }

  const closed =
    data.isEnded ||
    new Date(data.recruitEndAt) < new Date() ||
    data.appliedCount >= data.recruitCount;

  return (
    <div className={styles.cdetail}>
      <PageHeader showBack title={data.title} />
      <div
        className={styles.hero}
        style={data.thumbnailUrl ? { backgroundImage: `url(${data.thumbnailUrl})` } : undefined}
      />

      <div className={styles.body}>
        <div className={styles.head}>
          <h1 className={styles.title}>{data.title}</h1>
          <div className={styles.reward}>{formatYen(data.rewardJpy)}</div>
        </div>
        <div className={styles.period}>
          募集 {formatDate(data.recruitStartAt)} 〜 {formatDate(data.recruitEndAt)}
        </div>

        <ul className={styles.sns}>
          {data.snsRecruits.map((r: SnsRecruit) => (
            <li key={r.snsType} className={`${styles.snsRow} ${SNS_ROW_CLASS[r.snsType]}`}>
              <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
              <span className={styles.snsName}>{SNS_LABEL[r.snsType]}</span>
              <span className={styles.snsCount}>募集 {r.recruitCount}名</span>
              <span className={styles.snsCond}>
                条件:{" "}
                {r.minFollowers > 0
                  ? `${r.snsType === "YOUTUBE" ? "登録者" : "フォロワー"}数 ${r.minFollowers.toLocaleString("ja-JP")}+`
                  : "制限なし"}
              </span>
            </li>
          ))}
        </ul>

        <section className={styles.section}>
          <h3>商品</h3>
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: data.productSummary }} />
          <a href={data.productDetailUrl} target="_blank" rel="noreferrer" className={styles.link}>
            商品ページを見る →
          </a>
        </section>

        <section className={styles.section}>
          <h3>ガイドライン</h3>
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: data.guideline }} />
          {data.referenceMediaUrls.length > 0 && (
            <ul className={styles.refs}>
              {data.referenceMediaUrls.map((url: string) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.section}>
          <h3>注意事項</h3>
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: data.cautions }} />
        </section>
      </div>

      <div className={styles.cta}>
        {data.appliedSnsTypes.length > 0 && (
          <PrimaryButton onClick={() => nav("/applications")}>
            {/* 응모내역 보기 */}
            応募内訳を見る
          </PrimaryButton>
        )}
        {data.appliedSnsTypes.length < data.snsRecruits.length && (
          <PrimaryButton disabled={closed} onClick={() => nav(`/campaigns/${data.id}/apply`)}>
            {closed
              ? "募集終了" // 모집 종료
              : data.appliedSnsTypes.length > 0
                ? "別のSNSで応募する"
                : "応募する"}{" "}
            {/* 다른 SNS로 신청하기 : 신청하다 */}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
