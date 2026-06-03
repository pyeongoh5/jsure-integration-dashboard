import { Fragment } from "react";
import { MEDIA_META, type DraftReview } from "./types";

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
      <div className="dr-actions">
        <button
          type="button"
          className="dr-action dr-action--approve"
          onClick={() => handlers.onApprove(draft)}
        >
          승인
        </button>
        <button
          type="button"
          className="dr-action dr-action--reject"
          onClick={() => handlers.onReject(draft)}
        >
          반려
        </button>
      </div>
    );
  }

  if (draft.reviewStatus === "APPROVED") {
    if (draft.settledAt) {
      return (
        <span className="dr-settled" title={`정산일: ${draft.settledAt}`}>
          정산 완료
          {draft.settledAmountJpy !== null && (
            <span className="dr-settled__amount">
              {formatJpy(draft.settledAmountJpy)}
            </span>
          )}
        </span>
      );
    }
    return (
      <div className="dr-actions">
        <button
          type="button"
          className="dr-action dr-action--approve"
          onClick={() => handlers.onSettle(draft)}
        >
          정산하기
        </button>
        {!draft.insightSubmitted && (
          <button
            type="button"
            className="dr-action dr-action--undo"
            onClick={() => handlers.onUndo(draft)}
          >
            되돌리기
          </button>
        )}
      </div>
    );
  }

  if (draft.insightSubmitted) {
    return <span className="dr-locked">인사이트 제출 완료 · 되돌리기 불가</span>;
  }

  return (
    <button
      type="button"
      className="dr-action dr-action--undo"
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
      <div className="dr__card">
        <div className="dr__empty">해당 상태의 초안이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="dr__card">
      <table className="dr__table">
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
                    <div className="dr-inf">
                      <div
                        className="dr-inf__avatar"
                        style={{ background: pickAvatarColor(draft.id) }}
                      >
                        {draft.influencerName[0]}
                      </div>
                      <div>
                        <div className="dr-inf__name">{draft.influencerName}</div>
                        {draft.influencerHandle && (
                          <div className="dr-inf__handle">@{draft.influencerHandle}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{draft.campaignTitle}</td>
                  <td>
                    <span
                      className={`dr-media ${media.cls}`}
                      title={media.label}
                      aria-label={media.label}
                    >
                      <i className={media.icon} />
                    </span>
                  </td>
                  <td className="dr-url-cell">
                    <a
                      className="dr-url"
                      href={draft.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {draft.url}
                    </a>
                  </td>
                  <td className="dr-time">{draft.submittedAt}</td>
                  <td>
                    {draft.insightSubmitted ? (
                      <button
                        type="button"
                        className="dr-insight dr-insight--done dr-insight--btn"
                        onClick={() => onViewInsight(draft)}
                      >
                        제출됨 · 보기
                      </button>
                    ) : (
                      <span className="dr-insight dr-insight--pending">
                        대기
                      </span>
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
                  <tr className="dr-history-row">
                    <td colSpan={7}>
                      <div className="dr-history">
                        <div className="dr-history__title">
                          이전 반려 사유 ({draft.rejectionHistory.length})
                        </div>
                        <ul className="dr-history__list">
                          {draft.rejectionHistory.map((rejection) => (
                            <li key={rejection.id} className="dr-history__item">
                              <span className="dr-history__time">{rejection.rejectedAt}</span>
                              <span className="dr-history__comment">{rejection.comment}</span>
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
