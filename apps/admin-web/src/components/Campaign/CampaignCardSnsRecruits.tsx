import {
  SNS_FOLLOWER_LABEL,
  SNS_ICON_CLASS,
  type CampaignCardSnsRecruit,
} from "./types";

type Props = {
  recruits: CampaignCardSnsRecruit[];
};

export function CampaignCardSnsRecruits({ recruits }: Props) {
  if (recruits.length === 0) return null;
  return (
    <div className="cmp-card__sns">
      {recruits.map((r) => (
        <span key={r.snsType} className={`cmp-card__sns-chip cmp-card__sns-chip--${r.snsType.toLowerCase()}`}>
          <i className={SNS_ICON_CLASS[r.snsType]} aria-hidden="true" />
          <span className="cmp-card__sns-cond">
            {r.minFollowers > 0
              ? `${SNS_FOLLOWER_LABEL[r.snsType]} ${r.minFollowers.toLocaleString()}명 이상`
              : `${SNS_FOLLOWER_LABEL[r.snsType]} 제한 없음`}
          </span>
        </span>
      ))}
    </div>
  );
}
