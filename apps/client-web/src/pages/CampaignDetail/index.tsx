import { useNavigate, useParams } from "react-router-dom";
import {
  SUB_TYPE_LABEL,
  type InstagramPostType,
  type CampaignSubType,
  type CampaignRecruit,
} from "@jsure/shared";
import { useCampaign, formatYen, formatDate } from "@/domains/campaign";
import { PageHeader } from "../../components/composites/PageHeader";
import { PrimaryButton } from "../../components/composites/PrimaryButton";
import { t } from "@i18n";
import styles from "./CampaignDetail.module.css";

const SNS_ROW_CLASS: Record<CampaignSubType, string | undefined> = {
  INSTAGRAM: styles.snsRowInstagram,
  TIKTOK: styles.snsRowTiktok,
  X: styles.snsRowX,
  YOUTUBE: styles.snsRowYoutube,
  QOO10: undefined,
  LIPS: undefined,
  ATCOSME: undefined,
};

const SNS_ICON: Record<CampaignSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
  QOO10: "fa-solid fa-bag-shopping",
  LIPS: "fa-solid fa-bag-shopping",
  ATCOSME: "fa-solid fa-bag-shopping",
};

const SNS_LABEL = SUB_TYPE_LABEL;

const FAKE_PURCHASE_SUB_TYPES: readonly CampaignSubType[] = [
  "QOO10",
  "LIPS",
  "ATCOSME",
];

function isFakePurchaseSubType(subType: CampaignSubType): boolean {
  return FAKE_PURCHASE_SUB_TYPES.includes(subType);
}

function formatJpy(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

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
          {data.recruits.map((r: CampaignRecruit) => {
            if (isFakePurchaseSubType(r.subType)) {
              const productPrice = r.productPriceJpy ?? 0;
              const expectedSettlement = data.rewardJpy + productPrice;
              return (
                <li
                  key={r.subType}
                  className={`${styles.snsRow} ${SNS_ROW_CLASS[r.subType] ?? ""}`}
                >
                  <i className={SNS_ICON[r.subType]} aria-hidden="true" />
                  <span className={styles.snsName}>{SNS_LABEL[r.subType]}</span>
                  <span className={styles.snsCount}>
                    {t("pages.campaignDetail.recruitLabel")} {r.recruitCount}
                    {t("pages.campaignDetail.recruitCountSuffix")}
                  </span>
                  <span className={styles.snsCond}>
                    {t("campaign.detail.productPrice")}: {formatJpy(productPrice)}
                    {r.productUrl && (
                      <>
                        {" · "}
                        <a
                          href={r.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.inlineLink}
                        >
                          {t("campaign.detail.productUrl")}
                        </a>
                      </>
                    )}
                  </span>
                  <span className={styles.snsCond}>
                    {t("campaign.detail.expectedSettlement")}:{" "}
                    {formatJpy(expectedSettlement)}
                  </span>
                </li>
              );
            }
            const instagramTypes =
              r.subType === "INSTAGRAM" && r.instagramPostTypes.length > 0
                ? r.instagramPostTypes
                    .map((postType: InstagramPostType) => INSTAGRAM_POST_TYPE_LABEL[postType])
                    .join("・")
                : null;
            return (
              <li key={r.subType} className={`${styles.snsRow} ${SNS_ROW_CLASS[r.subType] ?? ""}`}>
                <i className={SNS_ICON[r.subType]} aria-hidden="true" />
                <span className={styles.snsName}>
                  {SNS_LABEL[r.subType]}
                  {instagramTypes ? ` (${instagramTypes})` : ""}
                </span>
                <span className={styles.snsCount}>
                  {t("pages.campaignDetail.recruitLabel")} {r.recruitCount}
                  {t("pages.campaignDetail.recruitCountSuffix")}
                </span>
                <span className={styles.snsCond}>
                  {t("pages.campaignDetail.condLabel")}
                  {r.minFollowers > 0
                    ? `${r.subType === "YOUTUBE" ? t("pages.campaignDetail.condSubscriber") : t("pages.campaignDetail.condFollower")} ${r.minFollowers.toLocaleString("ja-JP")}+`
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
        {data.appliedSubTypes.length > 0 && (
          <PrimaryButton onClick={() => nav("/applications")}>
            {t("pages.campaignDetail.viewApplications")}
          </PrimaryButton>
        )}
        {data.appliedSubTypes.length < data.recruits.length && (
          <PrimaryButton disabled={closed} onClick={() => nav(`/campaigns/${data.id}/apply`)}>
            {closed
              ? t("pages.campaignDetail.ctaClosed")
              : data.appliedSubTypes.length > 0
                ? t("pages.campaignDetail.ctaAppliedOther")
                : t("pages.campaignDetail.ctaApply")}
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
