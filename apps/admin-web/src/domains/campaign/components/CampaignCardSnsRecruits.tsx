import styles from "@/pages/Campaigns/Campaigns.module.css";
import {
  SNS_FOLLOWER_LABEL,
  SNS_ICON_CLASS,
  type CampaignCardSnsRecruit,
} from "../types";
import type { SnsType } from "@jsure/shared";

type Props = {
  recruits: CampaignCardSnsRecruit[];
};

const CHIP_CLASS: Record<SnsType, string | undefined> = {
  INSTAGRAM: styles.cardSnsChipInstagram,
  TIKTOK: styles.cardSnsChipTiktok,
  X: styles.cardSnsChipX,
  YOUTUBE: styles.cardSnsChipYoutube,
};

export function CampaignCardSnsRecruits({ recruits }: Props) {
  if (recruits.length === 0) return null;
  return (
    <div className={styles.cardSns}>
      {recruits.map((r) => (
        <span key={r.snsType} className={`${styles.cardSnsChip} ${CHIP_CLASS[r.snsType]}`}>
          <i className={SNS_ICON_CLASS[r.snsType]} aria-hidden="true" />
          <span className={styles.cardSnsCond}>
            {r.minFollowers > 0
              ? `${SNS_FOLLOWER_LABEL[r.snsType]} ${r.minFollowers.toLocaleString()}명 이상`
              : `${SNS_FOLLOWER_LABEL[r.snsType]} 제한 없음`}
          </span>
        </span>
      ))}
    </div>
  );
}
