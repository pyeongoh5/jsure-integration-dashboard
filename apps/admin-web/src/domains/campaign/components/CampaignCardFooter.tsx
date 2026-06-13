import styles from "@/pages/Campaigns/Campaigns.module.css";

type Props = {
  approved: number;
  applied: number;
  capacity: number;
};

export function CampaignCardFooter({ approved, applied, capacity }: Props) {
  const ratio = capacity > 0 ? Math.min(100, Math.round((approved / capacity) * 100)) : 0;

  return (
    <div className={styles.cardAffix}>
      <div className={styles.cardProgress}>
        <div className={styles.cardProgressText}>
          모집 {approved}/{capacity}명 ({ratio}%) · 응모 {applied}명
        </div>
        <div className={styles.cardProgressBar}>
          <div className={styles.cardProgressFill} style={{ width: `${ratio}%` }} />
        </div>
      </div>
    </div>
  );
}
