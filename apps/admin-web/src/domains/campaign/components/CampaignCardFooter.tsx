import styles from "@/pages/Campaigns/Campaigns.module.css";
import { useT } from "@/lib/i18n";

type Props = {
  approved: number;
  applied: number;
  capacity: number;
  viewers: number;
};

export function CampaignCardFooter({ approved, applied, capacity, viewers }: Props) {
  const t = useT();
  const ratio = capacity > 0 ? Math.min(100, Math.round((approved / capacity) * 100)) : 0;

  return (
    <div className={styles.cardAffix}>
      <div className={styles.cardProgress}>
        <div className={styles.cardProgressText}>
          {t("domains.campaign.card.footer", { approved, capacity, ratio, applied })}
          {" · "}
          {t("domains.campaign.card.viewerCount", { count: viewers.toLocaleString() })}
        </div>
        <div className={styles.cardProgressBar}>
          <div className={styles.cardProgressFill} style={{ width: `${ratio}%` }} />
        </div>
      </div>
    </div>
  );
}
