import type { InfluencerCampaignCard, SnsType } from "@jsure/shared";
import "./CampaignCard.css";

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

const SNS_FOLLOWER_LABEL: Record<SnsType, string> = {
  INSTAGRAM: "フォロワー",
  TIKTOK: "フォロワー",
  X: "フォロワー",
  YOUTUBE: "登録者",
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  card: InfluencerCampaignCard;
  onSelect: () => void;
}

function formatYen(v: number): string {
  return `¥${v.toLocaleString("ja-JP")}円`;
}

function formatDateRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };
  return `${fmt(startIso)} — ${fmt(endIso)}`;
}

function daysUntil(endIso: string, now: Date): number {
  const end = new Date(endIso);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

export function CampaignCard({ card, onSelect }: Props) {
  const ratio = card.recruitCount
    ? Math.min(100, Math.round((card.appliedCount / card.recruitCount) * 100))
    : 0;
  const dday = daysUntil(card.recruitEndAt, new Date());
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
      </div>

      <div className="ccard__body">
        <h3 className="ccard__title">{card.title}</h3>
        <p className="ccard__desc">{card.productSummary}</p>

        {card.snsRecruits.length > 0 && (
          <div className="ccard__sns">
            {card.snsRecruits.map((r) => (
              <span
                key={r.snsType}
                className={`ccard__sns-chip ccard__sns-chip--${r.snsType.toLowerCase()}`}
              >
                <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
                <span className="ccard__sns-cond">
                  {r.minFollowers > 0
                    ? `${SNS_FOLLOWER_LABEL[r.snsType]} ${r.minFollowers.toLocaleString("ja-JP")}人以上`
                    : `${SNS_FOLLOWER_LABEL[r.snsType]} 制限なし`}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="ccard__meta">
          <div className="ccard__meta-row">
            <i className="fa-regular fa-calendar" />
            <span>
              {formatDateRange(card.recruitStartAt, card.recruitEndAt)}
            </span>
          </div>
          <div className="ccard__meta-row">
            <i className="fa-solid fa-coins" />
            <span>{formatYen(card.rewardJpy)}</span>
          </div>
        </div>

        <div className="ccard__affix">
          <div className="ccard__progress">
            <div className="ccard__progress-text">
              募集 {card.appliedCount}/{card.recruitCount}名 ({ratio}%)
            </div>
            <div className="ccard__progress-bar">
              <div
                className="ccard__progress-fill"
                style={{ width: `${ratio}%` }}
              />
            </div>
          </div>
          <span
            className={`ccard__dday ${dday <= 7 ? "ccard__dday--urgent" : ""}`}
          >
            D-{dday}
          </span>
        </div>
      </div>
    </button>
  );
}
