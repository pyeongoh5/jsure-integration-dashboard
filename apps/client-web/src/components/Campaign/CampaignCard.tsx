import { useLayoutEffect, useRef } from "react";
import type { InfluencerCampaignCard, SnsType, SnsRecruit } from "@jsure/shared";
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

const MARQUEE_SPEED_PX_PER_SEC = 15;
const MARQUEE_PAUSE_MS = 1500;

function condText(r: SnsRecruit): string {
  return r.minFollowers > 0
    ? `${SNS_FOLLOWER_LABEL[r.snsType]} ${r.minFollowers.toLocaleString("ja-JP")}人以上`
    : `${SNS_FOLLOWER_LABEL[r.snsType]} 制限なし`;
}

function SnsChipList({ recruits }: { recruits: SnsRecruit[] }) {
  const wrapRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const trackRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useLayoutEffect(() => {
    const wraps = wrapRefs.current;
    const tracks = trackRefs.current;
    const anims: Animation[] = [];

    const apply = () => {
      anims.forEach((a) => a.cancel());
      anims.length = 0;

      const deltas = wraps.map((wrap, i) => {
        const track = tracks[i];
        if (!wrap || !track) return 0;
        track.style.transform = "";
        return Math.max(0, track.scrollWidth - wrap.clientWidth);
      });
      const maxDelta = Math.max(0, ...deltas);
      if (maxDelta <= 1) return;

      const maxScrollMs = (maxDelta / MARQUEE_SPEED_PX_PER_SEC) * 1000;
      const total = maxScrollMs + MARQUEE_PAUSE_MS;
      const startTime = document.timeline.currentTime as number | null;

      deltas.forEach((delta, i) => {
        const track = tracks[i];
        if (!track || delta <= 1) return;
        const scrollMs = (delta / MARQUEE_SPEED_PX_PER_SEC) * 1000;
        const anim = track.animate(
          [
            { transform: "translateX(0)", offset: 0 },
            { transform: `translateX(${-delta}px)`, offset: scrollMs / total },
            { transform: `translateX(${-delta}px)`, offset: 1 },
          ],
          { duration: total, iterations: Infinity, easing: "linear" },
        );
        if (startTime !== null) anim.startTime = startTime;
        anims.push(anim);
      });
    };

    apply();
    const ro = new ResizeObserver(apply);
    wraps.forEach((w) => w && ro.observe(w));
    return () => {
      ro.disconnect();
      anims.forEach((a) => a.cancel());
    };
  }, [recruits]);

  wrapRefs.current.length = recruits.length;
  trackRefs.current.length = recruits.length;

  return (
    <div className="ccard__sns">
      {recruits.map((r, i) => (
        <span
          key={r.snsType}
          className={`ccard__sns-chip ccard__sns-chip--${r.snsType.toLowerCase()}`}
        >
          <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
          <span
            ref={(el) => {
              wrapRefs.current[i] = el;
            }}
            className="ccard__sns-cond"
          >
            <span
              ref={(el) => {
                trackRefs.current[i] = el;
              }}
              className="ccard__sns-cond-track"
            >
              {condText(r)}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
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
        style={card.thumbnailUrl ? { backgroundImage: `url(${card.thumbnailUrl})` } : undefined}
      >
        {card.isNew && <div className="ccard__new">NEW</div>}
      </div>

      <div className="ccard__body">
        <h3 className="ccard__title">{card.title}</h3>
        <p className="ccard__desc">{card.productSummary}</p>

        {card.snsRecruits.length > 0 && <SnsChipList recruits={card.snsRecruits} />}

        <div className="ccard__meta">
          <div className="ccard__meta-row">
            <i className="fa-regular fa-calendar" />
            <span>{formatDateRange(card.recruitStartAt, card.recruitEndAt)}</span>
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
              <div className="ccard__progress-fill" style={{ width: `${ratio}%` }} />
            </div>
          </div>
          <span className={`ccard__dday ${dday <= 7 ? "ccard__dday--urgent" : ""}`}>D-{dday}</span>
        </div>
      </div>
    </button>
  );
}
