import type { SnsRecruit, SnsType } from "@jsure/shared";
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
  recruits: SnsRecruit[];
}

export function SnsBadgeList({ recruits }: Props) {
  return (
    <div className="sbl">
      {recruits.map((r) => (
        <div key={r.snsType} className="sbl__badge">
          <i className={ICON[r.snsType]} />
          <span>{LABEL[r.snsType]}</span>
          {r.minFollowers > 0 && (
            <span className="sbl__badge-cond">
              {r.snsType === "YOUTUBE" ? "登録者" : "フォロワー"}{" "}
              {r.minFollowers.toLocaleString("ja-JP")}+
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
