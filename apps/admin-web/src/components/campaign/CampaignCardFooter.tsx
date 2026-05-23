type Props = {
  approved: number;
  applied: number;
  capacity: number;
};

export function CampaignCardFooter({ approved, applied, capacity }: Props) {
  const ratio = capacity > 0 ? Math.min(100, Math.round((approved / capacity) * 100)) : 0;

  return (
    <div className="cmp-card__affix">
      <div className="cmp-card__progress">
        <div className="cmp-card__progress-text">
          모집 {approved}/{capacity}명 ({ratio}%) · 응모 {applied}명
        </div>
        <div className="cmp-card__progress-bar">
          <div className="cmp-card__progress-fill" style={{ width: `${ratio}%` }} />
        </div>
      </div>
    </div>
  );
}
