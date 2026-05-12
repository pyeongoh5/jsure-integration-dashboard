import type { CampaignStatus } from "./types";

type Props = {
  applied: number;
  capacity: number;
  dday: number;
  status: CampaignStatus;
};

export function CampaignCardFooter({ applied, capacity, dday, status }: Props) {
  const ratio = Math.min(100, Math.round((applied / capacity) * 100));

  return (
    <div className="cmp-card__affix">
      <div className="cmp-card__progress">
        <div className="cmp-card__progress-text">
          모집 {applied}/{capacity}명 ({ratio}%)
        </div>
        <div className="cmp-card__progress-bar">
          <div className="cmp-card__progress-fill" style={{ width: `${ratio}%` }} />
        </div>
      </div>
      {status !== "done" && (
        <span className={`cmp-card__dday ${dday <= 7 ? "cmp-card__dday--urgent" : ""}`}>
          D-{dday}
        </span>
      )}
    </div>
  );
}
