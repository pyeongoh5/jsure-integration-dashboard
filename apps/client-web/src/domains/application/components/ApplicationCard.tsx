import { SUB_TYPE_LABEL, type InfluencerApplication } from "@jsure/shared";
import { t } from "@i18n";
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
      return t("application.card.actionAwaitingReceipt");
    case "POSTING":
      return t("application.card.actionPosting");
    case "INSIGHT_DUE":
      return t("application.card.actionInsightDue");
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
    app.displayStage === "SETTLED" &&
    app.settlement?.completedAt &&
    app.settlement.amountJpy > 0 // 0원 정산은 입금 표기 생략
      ? `¥${app.settlement.amountJpy.toLocaleString("ja-JP")} (${formatDate(app.settlement.completedAt)} ${t("application.card.transferSuffix")})`
      : null;
  return (
    <button type="button" className={styles.card} onClick={onSelect}>
      <div className={styles.head}>
        <div className={styles.title}>
          {app.campaignTitle}
          {app.subTypes.map((subType) => { // 선택 옵션(FEED/REELS)은 한 태그로 합쳐 표기
            const selected = app.selectedOptions.find(
              (entry) => entry.subType === subType,
            );
            return (
              <span key={subType} className={styles.sns}>
                {selected
                  ? `${SUB_TYPE_LABEL[subType]} - ${selected.option}`
                  : SUB_TYPE_LABEL[subType]}
              </span>
            );
          })}
        </div>
        <StageBadge stage={app.displayStage} />
      </div>
      <div className={styles.meta}>
        ¥{app.rewardJpy.toLocaleString("ja-JP")}
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${ratio}%` }} />
      </div>
      {settled && (
        <div className={styles.settled}>
          {t("application.stageLabel.SETTLED")} — {settled}
        </div>
      )}
      {action && <div className={styles.cta}>{action}</div>}
    </button>
  );
}
