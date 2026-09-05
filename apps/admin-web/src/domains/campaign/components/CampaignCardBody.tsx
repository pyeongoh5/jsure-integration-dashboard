import styles from "@/pages/Campaigns/Campaigns.module.css";
import { TagChip } from "@/components/composites";
import { CampaignCardSnsRecruits } from "./CampaignCardSnsRecruits";
import type { CampaignCardRecruit } from "../types";

type Props = {
  thumbIcon: string;
  thumbnailUrl?: string | null;
  name: string;
  /** 어드민 전용 관리 태그 — 날짜 옆 배지로 표시. 인플루언서 화면에는 없는 개념. */
  tags: string[];
  description: string;
  period: string;
  reward: string;
  recruits: CampaignCardRecruit[];
};

export function CampaignCardBody({
  thumbIcon,
  thumbnailUrl,
  name,
  tags,
  description,
  period,
  reward,
  recruits,
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
      <CampaignCardSnsRecruits recruits={recruits} />
      <div className={styles.cardMeta}>
        <div className={styles.cardMetaRow}>
          <i className="fa-regular fa-calendar" />
          <span>{period}</span>
          {tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
        <div className={styles.cardMetaRow}>
          <i className="fa-solid fa-coins" />
          <span>{reward}</span>
        </div>
      </div>
    </>
  );
}
