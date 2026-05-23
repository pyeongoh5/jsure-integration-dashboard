import type { InfluencerCampaignCard, SnsType } from "@jsure/shared";
import "./CampaignCard.css";

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

interface Props {
  card: InfluencerCampaignCard;
  onSelect: () => void;
}

function formatYen(v: number): string {
  return `¥${v.toLocaleString("ja-JP")}`;
}

export function CampaignCard({ card, onSelect }: Props) {
  const ratio = card.recruitCount
    ? Math.min(100, Math.round((card.appliedCount / card.recruitCount) * 100))
    : 0;
  return (
    <button type="button" className="ccard" onClick={onSelect}>
      <div
        className="ccard__thumb"
        style={
          card.thumbnailUrl
            ? { backgroundImage: `url(${card.thumbnailUrl})` }
            : undefined
        }
      >
        {card.isNew && <div className="ccard__new">NEW</div>}
        {card.brandName && (
          <div className="ccard__brand">{card.brandName}</div>
        )}
        {card.brandTagline && (
          <div className="ccard__tagline">{card.brandTagline}</div>
        )}
      </div>
      <div className="ccard__body">
        <div className="ccard__title">{card.title}</div>
        <div className="ccard__reward">{formatYen(card.rewardJpy)}</div>
        <div className="ccard__meta">
          {card.minFollowers != null && (
            <div className="ccard__meta-row">
              <i className={SNS_ICON[card.snsTypes[0] ?? "INSTAGRAM"]} />
              <span>{card.minFollowers.toLocaleString("ja-JP")}人以上</span>
            </div>
          )}
          <div className="ccard__meta-row">
            <i className="fa-solid fa-gift" />
            <span>
              {card.appliedCount}/{card.recruitCount}名 ({ratio}%)
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
