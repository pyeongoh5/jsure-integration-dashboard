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
        className="cmp-card__thumb"
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
      <h3 className="cmp-card__name">{name}</h3>
      <p className="cmp-card__desc">{description}</p>
      <CampaignCardSnsRecruits recruits={snsRecruits} />
      <div className="cmp-card__meta">
        <div className="cmp-card__meta-row">
          <i className="fa-regular fa-calendar" />
          <span>{period}</span>
        </div>
        <div className="cmp-card__meta-row">
          <i className="fa-solid fa-coins" />
          <span>{reward}</span>
        </div>
      </div>
    </>
  );
}
