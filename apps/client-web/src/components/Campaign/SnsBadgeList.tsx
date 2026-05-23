import type { SnsType } from "@jsure/shared";
import "./SnsBadgeList.css";

const ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  YOUTUBE: "fa-brands fa-youtube",
  X: "fa-brands fa-x-twitter",
};

const LABEL: Record<SnsType, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X: "X",
};

interface Props {
  snsTypes: SnsType[];
  minFollowers: number | null;
}

export function SnsBadgeList({ snsTypes, minFollowers }: Props) {
  return (
    <div className="sbl">
      {snsTypes.map((t) => (
        <div key={t} className="sbl__badge">
          <i className={ICON[t]} />
          <span>{LABEL[t]}</span>
        </div>
      ))}
      {minFollowers != null && (
        <div className="sbl__badge sbl__badge--info">
          フォロワー {minFollowers.toLocaleString("ja-JP")}+
        </div>
      )}
    </div>
  );
}
