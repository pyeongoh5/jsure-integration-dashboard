import { Fragment } from "react";
import type { AdminTranslationKey } from "@i18n/admin";
import { ScrollTable, SnsProfileLink, SubTypePill } from "@/components/composites";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { CATEGORY_LABEL_KO } from "../applicants/types";
import { SUB_TYPE_LABEL } from "@jsure/shared";
import { subTypeOptionLabel } from "@/domains/application/subTypeOptionLabel";
import {
  DRAFT_STATUS_LABEL,
  MEDIA_META,
  SNS_TO_MEDIA,
  type DraftReview,
  type DraftStatus,
  type Media,
} from "./types";
import styles from "@/pages/Drafts/Drafts.module.css";
import shared from "../application.module.css";

const MEDIA_CLASS: Record<Media, string | undefined> = {
  ig: shared.mediaIg,
  yt: shared.mediaYt,
  tt: shared.mediaTt,
  x: shared.mediaX,
  qoo10: shared.mediaQoo10,
  lips: shared.mediaQoo10,
  atcosme: shared.mediaQoo10,
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

type TranslateFunction = ReturnType<typeof useT>;

type ActionHandlers = {
  onApprove: (draft: DraftReview) => void;
  onReject: (draft: DraftReview) => void;
  onUndo: (draft: DraftReview) => void;
  onSettle: (draft: DraftReview) => void;
  onViewInsight: (draft: DraftReview) => void;
  onMemo: (draft: DraftReview) => void;
  /** 감사 로그 다이얼로그 열기. showHistory(반려 이력 확장 행)와 다른 개념이다. */
  onHistory: (draft: DraftReview) => void;
};

function submissionButtonKey(draft: DraftReview): AdminTranslationKey {
  if (draft.category !== "SNS") return "domains.application.drafts.table.viewResult";
  if (draft.insightSubmitted) return "domains.application.drafts.table.viewInsight";
  return "domains.application.drafts.table.viewSubmission";
}

function formatJpy(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

function renderCategoryCell(draft: DraftReview, t: TranslateFunction) {
  const badgeClass = draft.category === "SNS" ? shared.categoryBadgeSns : shared.categoryBadgeFake;
  return (
    <span className={`${shared.categoryBadge} ${badgeClass}`}>
      {t(CATEGORY_LABEL_KO[draft.category])}
    </span>
  );
}

function renderStatusCell(draft: DraftReview, t: TranslateFunction) {
  const badge = (
    <span className={`${styles.statusBadge} ${STATUS_BADGE_CLASS[draft.status]}`}>
      {t(DRAFT_STATUS_LABEL[draft.status])}
    </span>
  );
  const amount =
    draft.settlement && (draft.status === "SETTLEMENT_PENDING" || draft.status === "SETTLED") ? (
      <span className={styles.statusAmount}>{formatJpy(draft.settlement.amountJpy)}</span>
    ) : null;
  return (
    <div className={styles.statusCell}>
      {badge}
      {amount}
    </div>
  );
}

function renderActions(
  draft: DraftReview,
  handlers: ActionHandlers,
  t: TranslateFunction,
) {
  const memoButton = (
    <Button variant="secondary" size="sm" onClick={() => handlers.onMemo(draft)}>
      {t("domains.application.applicants.actions.memo")}
    </Button>
  );
  const historyButton = (
    <Button variant="secondary" size="sm" onClick={() => handlers.onHistory(draft)}>
      {t("domains.application.applicants.actions.history")}
    </Button>
  );

  if (draft.status === "REVIEW_PENDING") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onApprove(draft)}>
          {t("domains.application.applicants.actions.approve")}
        </Button>
        <Button variant="danger" size="sm" onClick={() => handlers.onReject(draft)}>
          {t("domains.application.applicants.actions.reject")}
        </Button>
        {memoButton}
        {historyButton}
      </div>
    );
  }

  if (draft.status === "AWAITING_INSIGHT") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onSettle(draft)}>
          {t("domains.application.drafts.actions.settle")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(draft)}>
          {t("domains.application.applicants.actions.undo")}
        </Button>
        {memoButton}
        {historyButton}
      </div>
    );
  }

  if (draft.status === "INSIGHT_SUBMITTED") {
    return (
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={() => handlers.onSettle(draft)}>
          {t("domains.application.drafts.actions.settle")}
        </Button>
        {memoButton}
        {historyButton}
      </div>
    );
  }

  if (draft.status === "REJECTED") {
    return (
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(draft)}>
          {t("domains.application.applicants.actions.undo")}
        </Button>
        {memoButton}
        {historyButton}
      </div>
    );
  }

  // SETTLEMENT_PENDING / SETTLED / REJECTED_LOCKED — 추가 액션 없음(메모만).
  return (
    <div className={styles.actions}>
      {memoButton}
      {historyButton}
    </div>
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
  onMemo: (draft: DraftReview) => void;
  /** 감사 로그 다이얼로그 열기. showHistory(반려 이력 확장 행)와 다른 개념이다. */
  onHistory: (draft: DraftReview) => void;
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
  onHistory,
}: Props) {
  const t = useT();

  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>{t("domains.application.drafts.table.empty")}</div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <ScrollTable minWidth={1200}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("domains.application.applicants.table.influencer")}</th>
              <th>{t("domains.application.applicants.table.campaign")}</th>
              <th style={{ width: 120 }}>
                {t("domains.application.applicants.table.category")}
              </th>
              <th style={{ width: 90 }}>
                {t("domains.application.applicants.table.subType")}
              </th>
              <th>{t("domains.application.drafts.table.submissions")}</th>
              <th style={{ width: 90 }}>
                {t("domains.application.drafts.table.submittedAt")}
              </th>
              <th style={{ width: 160 }}>
                {t("domains.application.applicants.table.status")}
              </th>
              <th style={{ width: 200 }}>
                {t("domains.application.applicants.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((draft) => {
              const hasHistory = draft.rejectionHistory.length > 0;
              return (
                <Fragment key={draft.id}>
                  <tr>
                    <td>
                      <div className={shared.inf}>
                        <div
                          className={shared.infAvatar}
                          style={{ background: pickAvatarColor(draft.id) }}
                        >
                          {draft.influencerName[0]}
                        </div>
                        <div>
                          <div className={shared.infName}>
                            {draft.influencerName}
                            {draft.influencerFlagged && (
                              <span className={shared.flaggedBadge}>
                                {t("domains.application.applicants.table.flagged")}
                              </span>
                            )}
                          </div>
                          {draft.influencerHandle ? (
                            <div className={shared.infHandle}>
                              <SnsProfileLink
                                subType={draft.influencerHandleSnsType}
                                handle={draft.influencerHandle}
                              >
                                @{draft.influencerHandle}
                              </SnsProfileLink>
                            </div>
                          ) : draft.representativeSns ? (
                            <div className={shared.infHandle}>
                              <SnsProfileLink
                                subType={draft.representativeSns.snsType}
                                handle={draft.representativeSns.handle}
                              >
                                {t(
                                  "domains.application.applicants.table.representativeSns",
                                  {
                                    snsType:
                                      SUB_TYPE_LABEL[draft.representativeSns.snsType],
                                    handle: draft.representativeSns.handle,
                                  },
                                )}
                              </SnsProfileLink>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{draft.campaignTitle}</td>
                    <td>{renderCategoryCell(draft, t)}</td>
                    <td>
                      {draft.category === "FAKE_PURCHASE" ||
                      draft.category === "SIMPLE_REVIEW" ? (
                        <span className={shared.mediaItem}>
                          {draft.subTypes.map((subType) => (
                            <SubTypePill key={subType} subType={subType} />
                          ))}
                        </span>
                      ) : (
                        <span className={shared.mediaItem}>
                          {draft.subTypes.map((subType) => {
                            const media = MEDIA_META[SNS_TO_MEDIA[subType]];
                            // 선택 옵션(피드/릴스 등) 라벨은 해당 아이콘 바로 옆에 붙인다.
                            const selected = draft.selectedOptions.find(
                              (entry) => entry.subType === subType,
                            );
                            return (
                              <Fragment key={subType}>
                                <SnsProfileLink
                                  subType={subType}
                                  handle={draft.handleBySubType[subType]}
                                >
                                  <span
                                    className={`${shared.media} ${MEDIA_CLASS[SNS_TO_MEDIA[subType]]}`}
                                    title={media.label}
                                    aria-label={media.label}
                                  >
                                    <i className={media.icon} />
                                  </span>
                                </SnsProfileLink>
                                {selected && (
                                  <span className={shared.mediaLabel}>
                                    {subTypeOptionLabel(selected.option, t)}
                                  </span>
                                )}
                              </Fragment>
                            );
                          })}
                        </span>
                      )}
                    </td>
                    <td className={styles.urlCell}>
                      {/* URL 나열 대신 전 카테고리 공통 버튼 → 모달 UX. */}
                      <button
                        type="button"
                        className={styles.insightLink}
                        onClick={() => onViewInsight(draft)}
                      >
                        {t(submissionButtonKey(draft))}
                      </button>
                    </td>
                    <td className={styles.time}>{draft.submittedAt}</td>
                    <td>{renderStatusCell(draft, t)}</td>
                    <td>
                      {renderActions(
                        draft,
                        {
                          onApprove,
                          onReject,
                          onUndo,
                          onSettle,
                          onViewInsight,
                          onMemo,
                          onHistory,
                        },
                        t,
                      )}
                    </td>
                  </tr>
                  {showHistory && hasHistory && (
                    <tr className={styles.historyRow}>
                      <td colSpan={8}>
                        <div className={styles.history}>
                          <div className={styles.historyTitle}>
                            {t("domains.application.drafts.table.rejectionHistoryTitle", {
                              count: draft.rejectionHistory.length,
                            })}
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
