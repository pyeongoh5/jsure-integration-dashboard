import styles from "@/pages/Campaigns/Campaigns.module.css";
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
                .map((postType) => INSTAGRAM_POST_TYPE_LABEL[postType])
                .join("·")
            : null;
        return (
          <span key={r.subType} className={`${styles.cardSnsChip} ${CHIP_CLASS[r.subType] ?? ""}`}>
            <i className={SNS_ICON_CLASS[r.subType]} aria-hidden="true" />
            <span className={styles.cardSnsCond}>
              {r.minFollowers > 0
                ? `${SNS_FOLLOWER_LABEL[r.subType]} ${r.minFollowers.toLocaleString()}명 이상`
                : `${SNS_FOLLOWER_LABEL[r.subType]} 제한 없음`}
              {instagramTypes ? ` · ${instagramTypes}` : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}
