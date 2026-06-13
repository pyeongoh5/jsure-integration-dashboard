import styles from "@/pages/Applicants/Applicants.module.css";
import { ScrollTable } from "@/components/composites";
import { MEDIA_META, type Applicant, type ApplicantStage } from "./types";

type ActionHandlers = {
  onApprove: (applicant: Applicant) => void;
  onReject: (applicant: Applicant) => void;
  onUndo: (applicant: Applicant) => void;
  onShip: (applicant: Applicant) => void;
  onDeliver: (applicant: Applicant) => void;
};

function renderActions(applicant: Applicant, handlers: ActionHandlers) {
  if (applicant.status === "pending") {
    return (
      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.action} ${styles.actionApprove}`}
          onClick={() => handlers.onApprove(applicant)}
        >
          승인
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.actionReject}`}
          onClick={() => handlers.onReject(applicant)}
        >
          반려
        </button>
      </div>
    );
  }

  if (applicant.status === "rejected") {
    return (
      <button
        type="button"
        className={`${styles.action} ${styles.actionUndo}`}
        onClick={() => handlers.onUndo(applicant)}
      >
        되돌리기
      </button>
    );
  }

  // approved 탭 — rawStatus로 분기
  return (
    <div className={styles.actions}>
      {applicant.rawStatus === "APPROVED" && (
        <>
          <button
            type="button"
            className={`${styles.action} ${styles.actionApprove}`}
            onClick={() => handlers.onShip(applicant)}
          >
            운송장 입력
          </button>
          <button
            type="button"
            className={`${styles.action} ${styles.actionUndo}`}
            onClick={() => handlers.onUndo(applicant)}
          >
            되돌리기
          </button>
        </>
      )}
      {/* 수령 확인(receivedAt) 전, 즉 stage가 SHIPPING일 때만 노출.
          인플루언서가 먼저 수령 확인하면 stage가 POST_DUE(게시 대기)가 되어 숨겨진다. */}
      {applicant.stage === "SHIPPING" && (
        <button
          type="button"
          className={`${styles.action} ${styles.actionApprove}`}
          onClick={() => handlers.onDeliver(applicant)}
        >
          배송 완료
        </button>
      )}
    </div>
  );
}

const STAGE_LABEL: Record<ApplicantStage, { text: string; className: string | undefined }> =
  {
    PRE_SHIP: { text: "배송전", className: styles.stagePillPre },
    SHIPPING: { text: "배송중", className: styles.stagePillShipping },
    DELIVERED: { text: "배송완료", className: styles.stagePillDelivered },
    POST_DUE: { text: "게시 대기", className: styles.stagePillPostDue },
    REVIEW_DUE: { text: "검토 대기", className: styles.stagePillReviewDue },
    COMPLETED: { text: "완료", className: styles.stagePillCompleted },
  };

function renderStage(applicant: Applicant) {
  if (!applicant.stage) return null;
  const label = STAGE_LABEL[applicant.stage];
  const showTracking =
    applicant.stage !== "PRE_SHIP" && applicant.trackingNumber !== null;
  return (
    <div className={styles.stage}>
      <span className={`${styles.stagePill} ${label.className}`}>{label.text}</span>
      {showTracking && (
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
  showStage: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onApprove: (applicant: Applicant) => void;
  onReject: (applicant: Applicant) => void;
  onUndo: (applicant: Applicant) => void;
  onShip: (applicant: Applicant) => void;
  onDeliver: (applicant: Applicant) => void;
};

export function ApplicantTable({
  items,
  selected,
  showStage,
  onToggleAll,
  onToggleOne,
  onApprove,
  onReject,
  onUndo,
  onShip,
  onDeliver,
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
            <th>매체</th>
            <th>팔로워</th>
            <th>응모 시각</th>
            {showStage && (
              <th style={{ textAlign: "center" }}>상태</th>
            )}
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
                <div className={styles.inf}>
                  <div
                    className={styles.infAvatar}
                    style={{ background: pickAvatarColor(applicant.id) }}
                  >
                    {applicant.name[0]}
                  </div>
                  <div>
                    <div className={styles.infName}>{applicant.name}</div>
                    <div className={styles.infHandle}>@{applicant.handle}</div>
                  </div>
                </div>
              </td>
              <td>{applicant.campaign}</td>
              <td>
                <div className={styles.mediaList}>
                  {applicant.media.map((media) => {
                    const meta = MEDIA_META[media];
                    return (
                      <span
                        key={media}
                        className={`${styles.media} ${styles[meta.cls]}`}
                        title={meta.label}
                        aria-label={meta.label}
                      >
                        <i className={meta.icon} />
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className={styles.num}>{formatFollowers(applicant.followers)}</td>
              <td className={styles.time}>{applicant.appliedAt}</td>
              {showStage && (
                <td
                  className={styles.stageCell}
                  style={{ textAlign: "center" }}
                >
                  {renderStage(applicant)}
                </td>
              )}
              <td>
                {renderActions(applicant, {
                  onApprove,
                  onReject,
                  onUndo,
                  onShip,
                  onDeliver,
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
