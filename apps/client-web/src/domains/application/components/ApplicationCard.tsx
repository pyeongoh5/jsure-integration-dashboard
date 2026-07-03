import type { InfluencerApplication } from "@jsure/shared";
import { STAGE_PROGRESS, STAGE_TOTAL } from "../utils";
import { StageBadge } from "./StageBadge";
import styles from "./ApplicationCard.module.css";

interface Props {
  app: InfluencerApplication;
  onSelect: () => void;
}

function nextAction(app: InfluencerApplication): string | null {
  switch (app.displayStage) {
    case "AWAITING_RECEIPT":
      return "受領を確認";
    case "POSTING":
      return "投稿URLを提出";
    case "INSIGHT_DUE":
      return "インサイトを提出";
    default:
      return null;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function ApplicationCard({ app, onSelect }: Props) {
  const ratio = (STAGE_PROGRESS[app.displayStage] / STAGE_TOTAL) * 100;
  const action = nextAction(app);
  const settled =
    app.displayStage === "SETTLED" && app.settlement?.completedAt
      ? `¥${app.settlement.amountJpy.toLocaleString("ja-JP")} (${formatDate(app.settlement.completedAt)} 振込)`
      : null;
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <div className={styles.head}>
        <div className={styles.title}>
          {app.campaignTitle}
          <span className={styles.sns}>{app.subType}</span>
          {app.subType === "INSTAGRAM" && app.instagramPostType && (
            <span className={styles.sns}>{app.instagramPostType}</span>
          )}
        </div>
        <StageBadge stage={app.displayStage} />
      </div>
      <div className={styles.meta}>
        ¥{app.rewardJpy.toLocaleString("ja-JP")}
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${ratio}%` }} />
      </div>
      {settled && <div className={styles.settled}>支払完了 — {settled}</div>}
      {action && <div className={styles.cta}>{action}</div>}
    </button>
  );
}
