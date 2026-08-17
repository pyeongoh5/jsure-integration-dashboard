import styles from "@/pages/Campaigns/Campaigns.module.css";
import { useT } from "@/lib/i18n";
import {
  INSTAGRAM_POST_TYPE_LABEL,
  SNS_FOLLOWER_LABEL,
  SNS_ICON_CLASS,
  type CampaignCardRecruit,
} from "../types";
import type { CampaignSubType, InstagramPostType } from "@jsure/shared";

type Props = {
  recruits: CampaignCardRecruit[];
};

const CHIP_CLASS: Record<CampaignSubType, string | undefined> = {
  INSTAGRAM: styles.cardSnsChipInstagram,
  TIKTOK: styles.cardSnsChipTiktok,
  X: styles.cardSnsChipX,
  YOUTUBE: styles.cardSnsChipYoutube,
  QOO10: styles.cardSnsChipQoo10,
  LIPS: styles.cardSnsChipQoo10,
  ATCOSME: styles.cardSnsChipQoo10,
};

const INSTAGRAM_POST_TYPES: readonly InstagramPostType[] = ["FEED", "REELS"];

export function CampaignCardSnsRecruits({ recruits }: Props) {
  const t = useT();
  if (recruits.length === 0) return null;
  return (
    <div className={styles.cardSns}>
      {recruits.map((r) => {
        const instagramPostTypes =
          r.subType === "INSTAGRAM"
            ? INSTAGRAM_POST_TYPES.filter((postType) =>
                r.subTypeOptions.includes(postType),
              )
            : [];
        const instagramTypes =
          instagramPostTypes.length > 0
            ? instagramPostTypes
                .map((postType) => t(INSTAGRAM_POST_TYPE_LABEL[postType]))
                .join("·")
            : null;
        return (
          <span key={r.subType} className={`${styles.cardSnsChip} ${CHIP_CLASS[r.subType] ?? ""}`}>
            <i className={SNS_ICON_CLASS[r.subType]} aria-hidden="true" />
            <span className={styles.cardSnsCond}>
              {r.minFollowers > 0
                ? t("domains.campaign.card.minFollowers", {
                    label: t(SNS_FOLLOWER_LABEL[r.subType]),
                    count: r.minFollowers.toLocaleString(),
                  })
                : t("domains.campaign.card.noFollowerLimit", {
                    label: t(SNS_FOLLOWER_LABEL[r.subType]),
                  })}
              {instagramTypes ? ` · ${instagramTypes}` : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}
