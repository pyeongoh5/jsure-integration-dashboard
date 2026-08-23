import styles from "@/pages/Campaigns/Campaigns.module.css";
import { SubTypeIcon } from "@/components/composites";
import { useT } from "@/lib/i18n";
import {
  INSTAGRAM_POST_TYPE_LABEL,
  SNS_FOLLOWER_LABEL,
  type CampaignCardRecruit,
} from "../types";
import type { InstagramPostType } from "@jsure/shared";

type Props = {
  recruits: CampaignCardRecruit[];
};

const INSTAGRAM_POST_TYPES: readonly InstagramPostType[] = ["FEED", "REELS"];

export function CampaignCardSnsRecruits({ recruits }: Props) {
  const t = useT();
  if (recruits.length === 0) return null;
  return (
    <div className={styles.snsRow}>
      {recruits.map((recruit) => {
        const instagramPostTypes =
          recruit.subType === "INSTAGRAM"
            ? INSTAGRAM_POST_TYPES.filter((postType) =>
                recruit.subTypeOptions.includes(postType),
              )
            : [];
        const instagramTypes =
          instagramPostTypes.length > 0
            ? instagramPostTypes
                .map((postType) => t(INSTAGRAM_POST_TYPE_LABEL[postType]))
                .join("·")
            : null;
        return (
          <span key={recruit.subType} className={styles.snsChip}>
            <SubTypeIcon subType={recruit.subType} size="sm" />
            <span className={styles.snsCond}>
              {recruit.minFollowers > 0
                ? t("domains.campaign.card.minFollowers", {
                    label: t(SNS_FOLLOWER_LABEL[recruit.subType]),
                    count: recruit.minFollowers.toLocaleString(),
                  })
                : t("domains.campaign.card.noFollowerLimit", {
                    label: t(SNS_FOLLOWER_LABEL[recruit.subType]),
                  })}
              {instagramTypes ? ` · ${instagramTypes}` : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}
