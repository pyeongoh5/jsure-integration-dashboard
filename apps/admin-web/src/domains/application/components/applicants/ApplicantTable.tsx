import { SUB_TYPE_LABEL, SUB_TYPE_OPTION_LABEL } from "@jsure/shared";
import { ScrollTable, SubTypePill } from "@/components/composites";
import { Button } from "@/components/ui";
import {
  APPLICANT_STATUS_LABEL,
  CATEGORY_LABEL_KO,
  MEDIA_META,
  type Applicant,
  type ApplicantStatus,
} from "./types";
import { SNS_TO_MEDIA } from "./applicantTransform";
import styles from "@/pages/Applicants/Applicants.module.css";
import shared from "../application.module.css";

type ActionHandlers = {
  onApprove: (applicant: Applicant) => void;
  onReject: (applicant: Applicant) => void;
  onUndo: (applicant: Applicant) => void;
  onShip: (applicant: Applicant) => void;
  onDeliver: (applicant: Applicant) => void;
  onMemo: (applicant: Applicant) => void;
  onDetail: (applicant: Applicant) => void;
};

function renderActions(applicant: Applicant, handlers: ActionHandlers) {
  const memoButton = (
    <Button variant="secondary" size="sm" onClick={() => handlers.onMemo(applicant)}>
      메모
    </Button>
  );
  const detailButton =
    applicant.category === "FAKE_PURCHASE" ? (
      <Button variant="secondary" size="sm" onClick={() => handlers.onDetail(applicant)}>
        상세
      </Button>
    ) : null;
  const hasShipping = applicant.category === "SNS" || applicant.category === "SIMPLE_REVIEW";

  switch (applicant.status) {
    case "APPLIED":
      return (
        <div className={styles.actions}>
          <Button variant="primary" size="sm" onClick={() => handlers.onApprove(applicant)}>
            승인
          </Button>
          <Button variant="danger" size="sm" onClick={() => handlers.onReject(applicant)}>
            반려
          </Button>
          {detailButton}
          {memoButton}
        </div>
      );
    case "PRE_SHIP":
      return (
        <div className={styles.actions}>
          {hasShipping && (
            <Button variant="primary" size="sm" onClick={() => handlers.onShip(applicant)}>
              운송장 입력
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(applicant)}>
            되돌리기
          </Button>
          {detailButton}
          {memoButton}
        </div>
      );
    case "SHIPPING":
      return (
        <div className={styles.actions}>
          {hasShipping && (
            <Button variant="primary" size="sm" onClick={() => handlers.onDeliver(applicant)}>
              배송 완료
            </Button>
          )}
          {detailButton}
          {memoButton}
        </div>
      );
    case "DELIVERED":
    case "POST_DUE":
    case "AWAITING_REVIEW":
      // 인플루언서 측 작업 대기 단계 — 운영자가 할 액션 없음.
      return (
        <div className={styles.actions}>
          {detailButton}
          {memoButton}
        </div>
      );
    case "AWAITING_ORDER":
      return (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(applicant)}>
            되돌리기
          </Button>
          {detailButton}
          {memoButton}
        </div>
      );
    case "REJECTED":
      return (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => handlers.onUndo(applicant)}>
            되돌리기
          </Button>
          {detailButton}
          {memoButton}
        </div>
      );
  }
}

function renderCategory(applicant: Applicant) {
  const className =
    applicant.category === "SNS" ? shared.categoryBadgeSns : shared.categoryBadgeFake;
  return (
    <span className={`${shared.categoryBadge} ${className}`}>
      {CATEGORY_LABEL_KO[applicant.category]}
    </span>
  );
}

const STATUS_BADGE_CLASS: Record<ApplicantStatus, string | undefined> = {
  APPLIED: styles.statusApplied,
  PRE_SHIP: styles.stagePillPre,
  SHIPPING: styles.stagePillShipping,
  DELIVERED: styles.stagePillDelivered,
  POST_DUE: styles.stagePillPostDue,
  AWAITING_ORDER: styles.stagePillPre,
  AWAITING_REVIEW: styles.stagePillReviewDue,
  REJECTED: styles.statusRejected,
};

function renderStatus(applicant: Applicant) {
  const trackingVisible =
    (applicant.status === "SHIPPING" || applicant.status === "DELIVERED") &&
    applicant.trackingNumber !== null;
  return (
    <div className={styles.stage}>
      <span className={`${styles.stagePill} ${STATUS_BADGE_CLASS[applicant.status]}`}>
        {APPLICANT_STATUS_LABEL[applicant.status]}
      </span>
      {trackingVisible && (
        <span className={styles.stageTracking}>
          {applicant.trackingCarrier
            ? `${applicant.trackingCarrier} · ${applicant.trackingNumber}`
            : applicant.trackingNumber}
        </span>
      )}
    </div>
  );
}

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

function formatFollowers(followers: number): string {
  if (followers >= 1_000_000) return `${(followers / 1_000_000).toFixed(1)}M`;
  if (followers >= 1_000) return `${Math.round(followers / 1_000)}K`;
  return String(followers);
}

type Props = {
  items: Applicant[];
  selected: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onApprove: (applicant: Applicant) => void;
  onReject: (applicant: Applicant) => void;
  onUndo: (applicant: Applicant) => void;
  onShip: (applicant: Applicant) => void;
  onDeliver: (applicant: Applicant) => void;
  onMemo: (applicant: Applicant) => void;
  onDetail: (applicant: Applicant) => void;
};

export function ApplicantTable({
  items,
  selected,
  onToggleAll,
  onToggleOne,
  onApprove,
  onReject,
  onUndo,
  onShip,
  onDeliver,
  onMemo,
  onDetail,
}: Props) {
  if (items.length === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.empty}>해당 상태의 응모자가 없습니다.</div>
      </div>
    );
  }

  const allChecked = items.every((applicant) => selected.has(applicant.id));

  return (
    <div className={styles.card}>
      <ScrollTable>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.check}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={(event) => onToggleAll(event.target.checked)}
                />
              </th>
              <th>인플루언서</th>
              <th>캠페인</th>
              <th>카테고리</th>
              <th>서브타입</th>
              <th>팔로워</th>
              <th>응모 시각</th>
              <th style={{ textAlign: "center" }}>상태</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((applicant) => (
              <tr key={applicant.id}>
                <td className={styles.check}>
                  <input
                    type="checkbox"
                    checked={selected.has(applicant.id)}
                    onChange={() => onToggleOne(applicant.id)}
                  />
                </td>
                <td>
                  <div className={shared.inf}>
                    <div
                      className={shared.infAvatar}
                      style={{ background: pickAvatarColor(applicant.id) }}
                    >
                      {applicant.name[0]}
                    </div>
                    <div>
                      <div className={shared.infName}>
                        {applicant.name}
                        {applicant.flagged && <span className={shared.flaggedBadge}>대상외</span>}
                      </div>
                      {applicant.handle && (
                        <div className={shared.infHandle}>@{applicant.handle}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>{applicant.campaign}</td>
                <td width="100">{renderCategory(applicant)}</td>
                <td>
                  <div className={styles.mediaList}>
                    {applicant.category === "FAKE_PURCHASE" ||
                    applicant.category === "SIMPLE_REVIEW" ? (
                      <span className={shared.mediaItem}>
                        {applicant.subTypes.map((subType) => (
                          <SubTypePill key={subType} subType={subType} />
                        ))}
                      </span>
                    ) : (
                      applicant.subTypes.map((subType) => {
                        const meta = MEDIA_META[SNS_TO_MEDIA[subType]];
                        // 선택 옵션(피드/릴스 등) 라벨은 해당 아이콘 옆에 표시.
                        const selected = applicant.selectedOptions.find(
                          (entry) => entry.subType === subType,
                        );
                        return (
                          <span key={subType} className={shared.mediaItem}>
                            <span
                              className={`${shared.media} ${shared[meta.cls]}`}
                              title={meta.label}
                              aria-label={meta.label}
                            >
                              <i className={meta.icon} />
                            </span>
                            {selected && (
                              <span className={shared.mediaLabel}>
                                {SUB_TYPE_OPTION_LABEL[selected.option] ??
                                  selected.option}
                              </span>
                            )}
                          </span>
                        );
                      })
                    )}
                  </div>
                </td>
                <td className={styles.num}>
                  {applicant.followersBySubType.length > 1 ? (
                    <div className={styles.followerList}>
                      {applicant.followersBySubType.map((entry) => (
                        <div key={entry.subType}>
                          {SUB_TYPE_LABEL[entry.subType]}:{" "}
                          {formatFollowers(entry.followerCount)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    formatFollowers(applicant.followers)
                  )}
                </td>
                <td className={styles.time}>{applicant.appliedAt}</td>
                <td className={styles.stageCell} style={{ textAlign: "center" }}>
                  {renderStatus(applicant)}
                </td>
                <td>
                  {renderActions(applicant, {
                    onApprove,
                    onReject,
                    onUndo,
                    onShip,
                    onDeliver,
                    onMemo,
                    onDetail,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
