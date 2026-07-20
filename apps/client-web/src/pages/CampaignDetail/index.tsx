import { useNavigate, useParams } from "react-router-dom";
import {
  SUB_TYPE_LABEL,
  QOO10_REVIEW_CHANNEL_LABEL,
  type InstagramPostType,
  type CampaignSubType,
  type CampaignRecruit,
} from "@jsure/shared";
import {
  useCampaign,
  formatDate,
  formatRewardRange,
} from "@/domains/campaign";
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
  LIPS: undefined, // new
  ATCOSME: undefined, // new
};

const SNS_ICON: Record<CampaignSubType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
  QOO10: "fa-solid fa-bag-shopping",
  LIPS: "fa-solid fa-heart", // new
  ATCOSME: "fa-solid fa-star", // new
};

const SNS_LABEL = SUB_TYPE_LABEL;

const FAKE_PURCHASE_SUB_TYPES: readonly CampaignSubType[] = ["QOO10"];

function isFakePurchaseSubType(subType: CampaignSubType): boolean {
  return FAKE_PURCHASE_SUB_TYPES.includes(subType);
}

function formatReviewChannels(options: readonly string[]): string {
  const labels: string[] = [];
  for (const option of options) {
    if (option === "LIPS" || option === "ATCOSME") {
      labels.push(QOO10_REVIEW_CHANNEL_LABEL[option]);
    }
  }
  return labels.join(" · ");
}

function formatJpy(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: t("pages.campaignDetail.instagramFeed"),
  REELS: t("pages.campaignDetail.instagramReels"),
};

/** 옵션별 정원 분리 recruit 은 "フィード1名・リール2名" 형태로 표기. */ // new
function formatRecruitCounts(recruit: CampaignRecruit): string {
  const suffix = t("pages.campaignDetail.recruitCountSuffix");
  const hasSplitCounts =
    recruit.options.length > 0 &&
    recruit.options.every((option) => option.recruitCount !== null);
  if (!hasSplitCounts) return `${recruit.recruitCount}${suffix}`;
  return recruit.options
    .map(
      (option) =>
        `${INSTAGRAM_POST_TYPE_LABEL[option.option as InstagramPostType] ?? option.option}${option.recruitCount}${suffix}`,
    )
    .join("・");
}

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
    data.approvedCount >= data.recruitCount;

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
          <div className={styles.reward}>{formatRewardRange(data)}</div>
        </div>
        <div className={styles.period}>
          {t("pages.campaignDetail.recruitLabel")} {formatDate(data.recruitStartAt)} 〜{" "}
          {formatDate(data.recruitEndAt)}
        </div>

        <ul className={styles.sns}>
          {data.recruits.map((r: CampaignRecruit) => {
            if (isFakePurchaseSubType(r.subType)) {
              const productPrice = r.productPriceJpy ?? 0;
              // 개별보수 캠페인은 캠페인 고정 보수(0) 대신 서브타입 보수로 정산 예상액 계산.
              const rewardForRecruit =
                data.rewardType === "PER_SUBTYPE"
                  ? (r.rewardJpy ?? 0)
                  : data.rewardJpy;
              const expectedSettlement = rewardForRecruit + productPrice;
              const reviewChannels = formatReviewChannels(r.subTypeOptions);
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
                  {reviewChannels && (
                    <span className={styles.snsCond}>
                      {t("campaign.detail.reviewChannels")}: Qoo10 · {reviewChannels}
                    </span>
                  )}
                </li>
              );
            }
            const instagramOptions = r.subType === "INSTAGRAM"
              ? r.subTypeOptions.filter(
                  (option): option is InstagramPostType =>
                    option === "FEED" || option === "REELS",
                )
              : [];
            const instagramTypes =
              instagramOptions.length > 0
                ? instagramOptions
                    .map((postType) => INSTAGRAM_POST_TYPE_LABEL[postType])
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
                  {t("pages.campaignDetail.recruitLabel")} {formatRecruitCounts(r)}
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
          {data.productDetailUrls.map((url, index) => ( // new — 상품 상세 URL 복수 지원
            <div key={`${index}-${url}`}>
              <a href={url} target="_blank" rel="noreferrer" className={styles.link}>
                {data.productDetailUrls.length > 1
                  ? `${t("pages.campaignDetail.productLinkNumberedPrefix")}${index + 1}${t("pages.campaignDetail.productLinkNumberedSuffix")}`
                  : t("pages.campaignDetail.productLinkText")}
              </a>
            </div>
          ))}
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
        {data.hasApplied && !data.hasCancelled && ( // new — 응모 이력은 캠페인 단위 1건
          <PrimaryButton onClick={() => nav("/applications")}>
            {t("pages.campaignDetail.viewApplications")}
          </PrimaryButton>
        )}
        {!data.hasApplied && ( // new — 취소 이력 포함 재응모 불가
          <PrimaryButton disabled={closed} onClick={() => nav(`/campaigns/${data.id}/apply`)}>
            {closed
              ? t("pages.campaignDetail.ctaClosed")
              : t("pages.campaignDetail.ctaApply")}
          </PrimaryButton>
        )}
        {data.hasCancelled && ( // new
          <p className={styles.cancelledNotice}>
            {t("pages.campaignDetail.cancelledNotice")}
          </p>
        )}
      </div>
    </div>
  );
}
