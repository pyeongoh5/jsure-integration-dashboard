import { useLayoutEffect, useRef } from "react";
import type {
  InfluencerCampaignCard,
  InstagramPostType,
  SnsType,
  SnsRecruit,
} from "@jsure/shared";
import { t } from "@/i18n";
import styles from "./CampaignCard.module.css";

function snsChipClass(snsType: SnsType) {
  switch (snsType) {
    case "INSTAGRAM":
      return styles.snsChipInstagram;
    case "TIKTOK":
      return styles.snsChipTiktok;
    case "X":
      return styles.snsChipX;
    case "YOUTUBE":
      return styles.snsChipYoutube;
  }
}

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

const SNS_FOLLOWER_LABEL: Record<SnsType, string> = {
  INSTAGRAM: t("campaign.card.followerLabel"),
  TIKTOK: t("campaign.card.followerLabel"),
  X: t("campaign.card.followerLabel"),
  YOUTUBE: t("campaign.card.subscriberLabel"),
};

const INSTAGRAM_POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  FEED: t("campaign.card.instagramFeed"),
  REELS: t("campaign.card.instagramReels"),
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface Props {
  card: InfluencerCampaignCard;
  onSelect: () => void;
}

function formatYen(v: number): string {
  return `¥${v.toLocaleString("ja-JP")}${t("campaign.card.yenSuffix")}`;
}

function stripHtml(html: string): string {
  // 카드 미리보기용 — 태그 제거 + 연속 공백 정리
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const base =
    r.minFollowers > 0
      ? `${SNS_FOLLOWER_LABEL[r.snsType]} ${r.minFollowers.toLocaleString("ja-JP")}${t("campaign.card.followerMinSuffix")}`
      : `${SNS_FOLLOWER_LABEL[r.snsType]} ${t("campaign.card.noLimit")}`;
  if (r.snsType === "INSTAGRAM" && r.instagramPostTypes.length > 0) {
    const types = r.instagramPostTypes
      .map((postType) => INSTAGRAM_POST_TYPE_LABEL[postType])
      .join("・");
    return `${base} ・ ${types}`;
  }
  return base;
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
    <div className={styles.sns}>
      {recruits.map((r, i) => (
        <span
          key={r.snsType}
          className={`${styles.snsChip} ${snsChipClass(r.snsType)}`}
        >
          <i className={SNS_ICON[r.snsType]} aria-hidden="true" />
          <span
            ref={(el) => {
              wrapRefs.current[i] = el;
            }}
            className={styles.snsCond}
          >
            <span
              ref={(el) => {
                trackRefs.current[i] = el;
              }}
              className={styles.snsCondTrack}
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
    <button
      type="button"
      className={`${styles.card}${card.isEnded ? ` ${styles.ended}` : ""}`}
      onClick={onSelect}
    >
      <div
        className={styles.thumb}
        style={card.thumbnailUrl ? { backgroundImage: `url(${card.thumbnailUrl})` } : undefined}
      >
        {card.isNew && <div className={styles.new}>NEW</div>}
        {card.isEnded && <div className={styles.endedBadge}>{t("campaign.card.ended")}</div>}
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{card.title}</h3>
        <p className={styles.desc}>{stripHtml(card.productSummary)}</p>

        {card.snsRecruits.length > 0 && <SnsChipList recruits={card.snsRecruits} />}

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <i className="fa-regular fa-calendar" />
            <span>{formatDateRange(card.recruitStartAt, card.recruitEndAt)}</span>
          </div>
          <div className={styles.metaRow}>
            <i className="fa-solid fa-coins" />
            <span>{formatYen(card.rewardJpy)}</span>
          </div>
        </div>

        <div className={styles.affix}>
          <div className={styles.progress}>
            <div className={styles.progressText}>
              {t("campaign.card.recruitPrefix")} {card.appliedCount}/{card.recruitCount}
              {t("campaign.card.peopleSuffix")} ({ratio}%)
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${ratio}%` }} />
            </div>
          </div>
          {card.isEnded ? (
            <span className={`${styles.dday} ${styles.ddayEnded}`}>{t("campaign.card.ended")}</span>
          ) : (
            <span className={`${styles.dday} ${dday <= 7 ? styles.ddayUrgent : ""}`}>
              D-{dday}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
