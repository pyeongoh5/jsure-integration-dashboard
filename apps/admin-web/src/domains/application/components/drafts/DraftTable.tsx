import { Fragment } from "react";
import { SUB_TYPE_LABEL } from "@jsure/shared";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import { CATEGORY_LABEL_KO } from "../applicants/types";
import {
  DRAFT_STATUS_LABEL,
  MEDIA_META,
  type DraftReview,
  type DraftStatus,
  type Media,
} from "./types";
import { INSTAGRAM_POST_TYPE_LABEL } from "@/domains/campaign";
import styles from "@/pages/Drafts/Drafts.module.css";

const MEDIA_CLASS: Record<Media, string | undefined> = {
  ig: styles.mediaIg,
  yt: styles.mediaYt,
  tt: styles.mediaTt,
  x: styles.mediaX,
  qoo10: styles.mediaQoo10,
  lips: styles.mediaLips,
  atcosme: styles.mediaAtcosme,
};

const FAKE_PURCHASE_PILL_CLASS: Record<string, string> = {
  QOO10: styles.mediaPillQoo10 ?? "",
  LIPS: styles.mediaPillLips ?? "",
  ATCOSME: styles.mediaPillAtcosme ?? "",
};

// 상태별 배지 색 클래스. Drafts.module.css 에서 정의.
const STATUS_BADGE_CLASS: Record<DraftStatus, string | undefined> = {
  REVIEW_PENDING: styles.statusReviewPending,
  AWAITING_INSIGHT: styles.statusAwaitingInsight,
  INSIGHT_SUBMITTED: styles.statusInsightSubmitted,
  SETTLEMENT_PENDING: styles.statusSettlementPending,
  SETTLED: styles.statusSettled,
  REJECTED: styles.statusRejected,
  REJECTED_LOCKED: styles.statusRejectedLocked,
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
  onMemo: (draft: DraftReview) => void;
};

function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

function renderCategoryCell(draft: DraftReview) {
  const badgeClass =
    draft.category === "SNS" ? styles.categoryBadgeSns : styles.categoryBadgeFake;
  return (
    <span className={`${styles.categoryBadge} ${badgeClass}`}>
      {CATEGORY_LABEL_KO[draft.category]}
    </span>
  );
}

function renderStatusCell(
  draft: DraftReview,
  onViewInsight: (draft: DraftReview) => void,
) {
  const badge = (
    <span className={`${styles.statusBadge} ${STATUS_BADGE_CLASS[draft.status]}`}>
      {DRAFT_STATUS_LABEL[draft.status]}
    </span>
  );
  const hasContent = draft.category === "FAKE_PURCHASE" || draft.insightSubmitted;
  const insightLink = hasContent && (
    <button
      type="button"
      className={styles.insightLink}
      onClick={() => onViewInsight(draft)}
    >
      보기
    </button>
  );
  const amount =
    draft.settlement &&
    (draft.status === "SETTLEMENT_PENDING" || draft.status === "SETTLED") ? (
      <span className={styles.statusAmount}>
        {formatJpy(draft.settlement.amountJpy)}
      </span>
    ) : null;
  return (
    <div className={styles.statusCell}>
      {badge}
      {amount}
      {insightLink}
    </div>
  );
}

function renderActions(draft: DraftReview, handlers: ActionHandlers) {
  const memoButton = (
    <Button variant="secondary" size="sm" onClick={() => handlers.onMemo(draft)}>
      메모
    </Button>
  );

  if (draft.status === "REVIEW_PENDING") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onApprove(draft)}>
          승인
        </Button>
        <Button variant="danger" size="sm" onClick={() => handlers.onReject(draft)}>
          반려
        </Button>
        {memoButton}
      </div>
    );
  }

  if (draft.status === "AWAITING_INSIGHT") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onSettle(draft)}>
          정산하기
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(draft)}>
          되돌리기
        </Button>
        {memoButton}
      </div>
    );
  }

  if (draft.status === "INSIGHT_SUBMITTED") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onSettle(draft)}>
          정산하기
        </Button>
        {memoButton}
      </div>
    );
  }

  if (draft.status === "REJECTED") {
    return (
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(draft)}>
          되돌리기
        </Button>
        {memoButton}
      </div>
    );
  }

  // SETTLEMENT_PENDING / SETTLED / REJECTED_LOCKED — 추가 액션 없음(메모만).
  return <div className={styles.actions}>{memoButton}</div>;
}

type Props = {
  items: DraftReview[];
  showHistory: boolean;
  onApprove: (draft: DraftReview) => void;
  onReject: (draft: DraftReview) => void;
  onUndo: (draft: DraftReview) => void;
  onSettle: (draft: DraftReview) => void;
  onViewInsight: (draft: DraftReview) => void;
  onMemo: (draft: DraftReview) => void;
};

export function DraftTable({
  items,
  showHistory,
  onApprove,
  onReject,
  onUndo,
  onSettle,
  onViewInsight,
  onMemo,
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
      <ScrollTable minWidth={1200}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>인플루언서</th>
              <th>캠페인</th>
              <th style={{ width: 120 }}>카테고리</th>
              <th style={{ width: 70 }}>매체</th>
              <th>제출 URL</th>
              <th style={{ width: 90 }}>제출 시각</th>
              <th style={{ width: 160 }}>상태</th>
              <th style={{ width: 200 }}>액션</th>
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
                          <div className={styles.infName}>
                            {draft.influencerName}
                            {draft.influencerFlagged && (
                              <span className={styles.flaggedBadge}>대상외</span>
                            )}
                          </div>
                          {draft.influencerHandle && (
                            <div className={styles.infHandle}>@{draft.influencerHandle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{draft.campaignTitle}</td>
                    <td>{renderCategoryCell(draft)}</td>
                    <td>
                      {draft.category === "FAKE_PURCHASE" ? (
                        <span className={styles.mediaItem}>
                          <span
                            className={`${styles.mediaPill} ${FAKE_PURCHASE_PILL_CLASS[draft.subType] ?? ""}`}
                            title={SUB_TYPE_LABEL[draft.subType]}
                            aria-label={SUB_TYPE_LABEL[draft.subType]}
                          >
                            {SUB_TYPE_LABEL[draft.subType]}
                          </span>
                        </span>
                      ) : (
                        <span className={styles.mediaItem}>
                          <span
                            className={`${styles.media} ${MEDIA_CLASS[draft.media]}`}
                            title={media.label}
                            aria-label={media.label}
                          >
                            <i className={media.icon} />
                          </span>
                          {draft.media === "ig" && draft.instagramPostType !== null && (
                            <span className={styles.mediaLabel}>
                              {INSTAGRAM_POST_TYPE_LABEL[draft.instagramPostType]}
                            </span>
                          )}
                        </span>
                      )}
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
                    <td>{renderStatusCell(draft, onViewInsight)}</td>
                    <td>
                      {renderActions(draft, {
                        onApprove,
                        onReject,
                        onUndo,
                        onSettle,
                        onViewInsight,
                        onMemo,
                      })}
                    </td>
                  </tr>
                  {showHistory && hasHistory && (
                    <tr className={styles.historyRow}>
                      <td colSpan={8}>
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
      </ScrollTable>
    </div>
  );
}
