import { STATUS_LABEL, type CampaignStatus } from "./types";

type Props = {
  status: CampaignStatus;
  dday: number;
};

export function CampaignCardTitle({ status, dday }: Props) {
  return (
    <div className="cmp-title-wrapper">
      <span className={`cmp-card__status cmp-card__status--${status}`}>{STATUS_LABEL[status]}</span>
      {status !== "done" && (
        <span className={`cmp-card__dday ${dday <= 7 ? "cmp-card__dday--urgent" : ""}`}>
          D-{dday}
        </span>
      )}
    </div>
  );
}
