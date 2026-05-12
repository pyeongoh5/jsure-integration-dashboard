import { STATUS_LABEL, type CampaignStatus } from "./types";

type Props = {
  brand: string;
  status: CampaignStatus;
};

export function CampaignCardTitle({ brand, status }: Props) {
  return (
    <>
      <span className="cmp-card__brand">{brand}</span>
      <span className={`cmp-card__status cmp-card__status--${status}`}>
        {STATUS_LABEL[status]}
      </span>
    </>
  );
}
