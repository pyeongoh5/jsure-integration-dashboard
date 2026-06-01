import type { InfluencerApplication } from "@jsure/shared";
import { STAGE_PROGRESS, STAGE_TOTAL } from "../../lib/stage";
import { StageBadge } from "./StageBadge";
import "./ApplicationCard.css";

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

export function ApplicationCard({ app, onSelect }: Props) {
  const ratio = (STAGE_PROGRESS[app.displayStage] / STAGE_TOTAL) * 100;
  const action = nextAction(app);
  return (
    <button type="button" className="acard" onClick={onSelect}>
      <div className="acard__head">
        <div className="acard__title">{app.campaignTitle}</div>
        <StageBadge stage={app.displayStage} />
      </div>
      <div className="acard__meta">
        ¥{app.rewardJpy.toLocaleString("ja-JP")}
      </div>
      <div className="acard__bar">
        <div className="acard__bar-fill" style={{ width: `${ratio}%` }} />
      </div>
      {action && <div className="acard__cta">{action}</div>}
    </button>
  );
}
