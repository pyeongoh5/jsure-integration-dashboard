import { useNavigate, useParams } from "react-router-dom";
import type { InstagramPostType, SnsType, SnsRecruit } from "@jsure/shared";
import { useCampaign, formatYen, formatDate } from "@/domains/campaign";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { t } from "@/i18n";
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

const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: t("pages.campaignDetail.instagramFeed"),
  REELS: t("pages.campaignDetail.instagramReels"),
};

export function CampaignDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const { data, isLoading, isError } = useCampaign(id);

  if (isLoading) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.loading}>{t("pages.campaignDetail.loading")}</div>
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div>
        <PageHeader showBack />
        <div className={styles.empty}>{t("pages.campaignDetail.loadError")}</div>
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
          {t("pages.campaignDetail.recruitLabel")} {formatDate(data.recruitStartAt)} 〜{" "}
          {formatDate(data.recruitEndAt)}
        </div>

        <ul className={styles.sns}>
          {data.snsRecruits.map((r: SnsRecruit) => {
            const instagramTypes =
              r.snsType === "INSTAGRAM" && r.instagramPostTypes.length > 0
                ? r.instagramPostTypes
                    .map((postType) => INSTAGRAM_POST_TYPE_LABEL[postType])
                    .join("・")
                : null;
            return (
              <li key={r.snsType} className={`${styles.snsRow} ${SNS_ROW_CLASS[r.snsType]}`}>
                <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
                <span className={styles.snsName}>
                  {SNS_LABEL[r.snsType]}
                  {instagramTypes ? ` (${instagramTypes})` : ""}
                </span>
                <span className={styles.snsCount}>
                  {t("pages.campaignDetail.recruitLabel")} {r.recruitCount}
                  {t("pages.campaignDetail.recruitCountSuffix")}
                </span>
                <span className={styles.snsCond}>
                  {t("pages.campaignDetail.condLabel")}
                  {r.minFollowers > 0
                    ? `${r.snsType === "YOUTUBE" ? t("pages.campaignDetail.condSubscriber") : t("pages.campaignDetail.condFollower")} ${r.minFollowers.toLocaleString("ja-JP")}+`
                    : t("pages.campaignDetail.noLimit")}
                </span>
              </li>
            );
          })}
        </ul>

        <section className={styles.section}>
          <h3>{t("pages.campaignDetail.sectionProduct")}</h3>
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: data.productSummary }} />
          <a href={data.productDetailUrl} target="_blank" rel="noreferrer" className={styles.link}>
            {t("pages.campaignDetail.productLinkText")}
          </a>
        </section>

        <section className={styles.section}>
          <h3>{t("pages.campaignDetail.sectionGuideline")}</h3>
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
          <h3>{t("pages.campaignDetail.sectionCautions")}</h3>
          <div className={styles.rich} dangerouslySetInnerHTML={{ __html: data.cautions }} />
        </section>
      </div>

      <div className={styles.cta}>
        {data.appliedSnsTypes.length > 0 && (
          <PrimaryButton onClick={() => nav("/applications")}>
            {t("pages.campaignDetail.viewApplications")}
          </PrimaryButton>
        )}
        {data.appliedSnsTypes.length < data.snsRecruits.length && (
          <PrimaryButton disabled={closed} onClick={() => nav(`/campaigns/${data.id}/apply`)}>
            {closed
              ? t("pages.campaignDetail.ctaClosed")
              : data.appliedSnsTypes.length > 0
                ? t("pages.campaignDetail.ctaAppliedOther")
                : t("pages.campaignDetail.ctaApply")}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
