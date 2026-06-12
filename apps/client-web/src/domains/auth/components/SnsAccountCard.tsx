import type { SnsType } from "@jsure/shared";
import "./SnsAccountCard.css";

interface Props {
  snsType: SnsType;
  enabled: boolean;
  handle: string;
  followerCount: string;
  onToggle: () => void;
  onChange: (field: "handle" | "followerCount", v: string) => void;
}

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

export function SnsAccountCard({
  snsType,
  enabled,
  handle,
  followerCount,
  onToggle,
  onChange,
}: Props) {
  return (
    <div className={`snsc ${enabled ? "snsc--on" : ""}`}>
      <button type="button" className="snsc__head" onClick={onToggle}>
        <i className={`${ICON[snsType]} snsc__icon`} />
        <span className="snsc__name">{LABEL[snsType]}</span>
        <span className={`snsc__toggle ${enabled ? "snsc__toggle--on" : ""}`} />
      </button>
      {enabled && (
        <div className="snsc__body">
          <label className="snsc__field">
            <span>ID</span>
            <input
              type="text"
              value={handle}
              onChange={(e) => onChange("handle", e.target.value)}
              placeholder="ID"
            />
          </label>
          <label className="snsc__field">
            <span>フォロワー数</span>
            <input
              type="text"
              inputMode="numeric"
              value={followerCount}
              onChange={(e) => onChange("followerCount", e.target.value.replace(/[^\d]/g, ""))}
              placeholder="12500"
            />
          </label>
        </div>
      )}
    </div>
  );
}
