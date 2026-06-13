import styles from "@/pages/Campaigns/Campaigns.module.css";
import { CampaignCardSnsRecruits } from "./CampaignCardSnsRecruits";
import type { CampaignCardSnsRecruit } from "../types";

type Props = {
  thumbIcon: string;
  thumbnailUrl?: string | null;
  name: string;
  description: string;
  period: string;
  reward: string;
  snsRecruits: CampaignCardSnsRecruit[];
};

export function CampaignCardBody({
  thumbIcon,
  thumbnailUrl,
  name,
  description,
  period,
  reward,
  snsRecruits,
}: Props) {
  return (
    <>
      <div
        className={styles.cardThumb}
        style={
          thumbnailUrl
            ? {
                backgroundImage: `url(${thumbnailUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!thumbnailUrl && thumbIcon}
      </div>
      <h3 className={styles.cardName}>{name}</h3>
      <p className={styles.cardDesc}>{description}</p>
      <CampaignCardSnsRecruits recruits={snsRecruits} />
      <div className={styles.cardMeta}>
        <div className={styles.cardMetaRow}>
          <i className="fa-regular fa-calendar" />
          <span>{period}</span>
        </div>
        <div className={styles.cardMetaRow}>
          <i className="fa-solid fa-coins" />
          <span>{reward}</span>
        </div>
      </div>
    </>
  );
}
