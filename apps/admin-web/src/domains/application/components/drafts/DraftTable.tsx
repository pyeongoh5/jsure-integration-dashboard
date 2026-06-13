import { Fragment } from "react";
import { MEDIA_META, type DraftReview, type Media } from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";

const MEDIA_CLASS: Record<Media, string | undefined> = {
  ig: styles.mediaIg,
  yt: styles.mediaYt,
  tt: styles.mediaTt,
  x: styles.mediaX,
};

const AVATAR_PALETTE = [
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

type ActionHandlers = {
  onApprove: (draft: DraftReview) => void;
  onReject: (draft: DraftReview) => void;
  onUndo: (draft: DraftReview) => void;
  onSettle: (draft: DraftReview) => void;
  onViewInsight: (draft: DraftReview) => void;
};

function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

function renderActions(draft: DraftReview, handlers: ActionHandlers) {
  if (draft.reviewStatus === "PENDING") {
    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.action} ${styles.actionApprove}`}
          onClick={() => handlers.onApprove(draft)}
        >
          승인
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.actionReject}`}
          onClick={() => handlers.onReject(draft)}
        >
          반려
        </button>
      </div>
    );
  }

  if (draft.reviewStatus === "APPROVED") {
    if (draft.settlement?.status === "COMPLETED") {
      return (
        <span className={styles.settled}>
          정산 완료
          <span className={styles.settledAmount}>{formatJpy(draft.settlement.amountJpy)}</span>
        </span>
      );
    }
    if (draft.settlement?.status === "PENDING") {
      return (
        <span className={styles.settled} title="정산 페이지에서 처리 대기 중">
          정산 대기
          <span className={styles.settledAmount}>{formatJpy(draft.settlement.amountJpy)}</span>
        </span>
      );
    }
    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.action} ${styles.actionApprove}`}
          onClick={() => handlers.onSettle(draft)}
        >
          정산하기
        </button>
        {!draft.insightSubmitted && (
          <button
            type="button"
            className={`${styles.action} ${styles.actionUndo}`}
            onClick={() => handlers.onUndo(draft)}
          >
            되돌리기
          </button>
        )}
      </div>
    );
  }

  if (draft.insightSubmitted) {
    return <span className={styles.locked}>인사이트 제출 완료 · 되돌리기 불가</span>;
  }

  return (
    <button
      type="button"
      className={`${styles.action} ${styles.actionUndo}`}
      onClick={() => handlers.onUndo(draft)}
    >
      되돌리기
    </button>
  );
}

type Props = {
  items: DraftReview[];
  showHistory: boolean;
  onApprove: (draft: DraftReview) => void;
  onReject: (draft: DraftReview) => void;
  onUndo: (draft: DraftReview) => void;
  onSettle: (draft: DraftReview) => void;
  onViewInsight: (draft: DraftReview) => void;
};

export function DraftTable({
  items,
  showHistory,
  onApprove,
  onReject,
  onUndo,
  onSettle,
  onViewInsight,
}: Props) {
  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>검토할 내용이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>인플루언서</th>
            <th>캠페인</th>
            <th>매체</th>
            <th>제출 URL</th>
            <th>제출 시각</th>
            <th>인사이트</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {items.map((draft) => {
            const media = MEDIA_META[draft.media];
            const hasHistory = draft.rejectionHistory.length > 0;
            return (
              <Fragment key={draft.id}>
                <tr>
                  <td>
                    <div className={styles.inf}>
                      <div
                        className={styles.infAvatar}
                        style={{ background: pickAvatarColor(draft.id) }}
                      >
                        {draft.influencerName[0]}
                      </div>
                      <div>
                        <div className={styles.infName}>{draft.influencerName}</div>
                        {draft.influencerHandle && (
                          <div className={styles.infHandle}>@{draft.influencerHandle}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{draft.campaignTitle}</td>
                  <td>
                    <span
                      className={`${styles.media} ${MEDIA_CLASS[draft.media]}`}
                      title={media.label}
                      aria-label={media.label}
                    >
                      <i className={media.icon} />
                    </span>
                  </td>
                  <td className={styles.urlCell}>
                    <a
                      className={styles.url}
                      href={draft.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {draft.url}
                    </a>
                  </td>
                  <td className={styles.time}>{draft.submittedAt}</td>
                  <td>
                    {draft.insightSubmitted ? (
                      <button
                        type="button"
                        className={`${styles.insight} ${styles.insightDone} ${styles.insightBtn}`}
                        onClick={() => onViewInsight(draft)}
                      >
                        제출됨 · 보기
                      </button>
                    ) : (
                      <span className={`${styles.insight} ${styles.insightPending}`}>대기</span>
                    )}
                  </td>
                  <td>
                    {renderActions(draft, {
                      onApprove,
                      onReject,
                      onUndo,
                      onSettle,
                      onViewInsight,
                    })}
                  </td>
                </tr>
                {showHistory && hasHistory && (
                  <tr className={styles.historyRow}>
                    <td colSpan={7}>
                      <div className={styles.history}>
                        <div className={styles.historyTitle}>
                          이전 반려 사유 ({draft.rejectionHistory.length})
                        </div>
                        <ul className={styles.historyList}>
                          {draft.rejectionHistory.map((rejection) => (
                            <li key={rejection.id} className={styles.historyItem}>
                              <span className={styles.historyTime}>{rejection.rejectedAt}</span>
                              <span className={styles.historyComment}>{rejection.comment}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
