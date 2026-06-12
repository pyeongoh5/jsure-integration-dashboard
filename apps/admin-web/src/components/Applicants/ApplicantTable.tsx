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
      <div className="apl-actions">
        <button
          type="button"
          className="apl-action apl-action--approve"
          onClick={() => handlers.onApprove(applicant)}
        >
          승인
        </button>
        <button
          type="button"
          className="apl-action apl-action--reject"
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
        className="apl-action apl-action--undo"
        onClick={() => handlers.onUndo(applicant)}
      >
        되돌리기
      </button>
    );
  }

  // approved 탭 — rawStatus로 분기
  return (
    <div className="apl-actions">
      {applicant.rawStatus === "APPROVED" && (
        <>
          <button
            type="button"
            className="apl-action apl-action--approve"
            onClick={() => handlers.onShip(applicant)}
          >
            운송장 입력
          </button>
          <button
            type="button"
            className="apl-action apl-action--undo"
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
          className="apl-action apl-action--approve"
          onClick={() => handlers.onDeliver(applicant)}
        >
          배송 완료
        </button>
      )}
    </div>
  );
}

const STAGE_LABEL: Record<ApplicantStage, { text: string; className: string }> =
  {
    PRE_SHIP: { text: "배송전", className: "apl-stage__pill--pre" },
    SHIPPING: { text: "배송중", className: "apl-stage__pill--shipping" },
    DELIVERED: { text: "배송완료", className: "apl-stage__pill--delivered" },
    POST_DUE: { text: "게시 대기", className: "apl-stage__pill--post-due" },
    REVIEW_DUE: { text: "검토 대기", className: "apl-stage__pill--review-due" },
    COMPLETED: { text: "완료", className: "apl-stage__pill--completed" },
  };

function renderStage(applicant: Applicant) {
  if (!applicant.stage) return null;
  const label = STAGE_LABEL[applicant.stage];
  const showTracking =
    applicant.stage !== "PRE_SHIP" && applicant.trackingNumber !== null;
  return (
    <div className="apl-stage">
      <span className={`apl-stage__pill ${label.className}`}>{label.text}</span>
      {showTracking && (
        <span className="apl-stage__tracking">
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
      <div className="apl__card">
        <div className="apl__empty">해당 상태의 응모자가 없습니다.</div>
      </div>
    );
  }

  const allChecked = items.every((applicant) => selected.has(applicant.id));

  return (
    <div className="apl__card">
      <table className="apl__table">
        <thead>
          <tr>
            <th className="apl-check">
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
              <td className="apl-check">
                <input
                  type="checkbox"
                  checked={selected.has(applicant.id)}
                  onChange={() => onToggleOne(applicant.id)}
                />
              </td>
              <td>
                <div className="apl-inf">
                  <div
                    className="apl-inf__avatar"
                    style={{ background: pickAvatarColor(applicant.id) }}
                  >
                    {applicant.name[0]}
                  </div>
                  <div>
                    <div className="apl-inf__name">{applicant.name}</div>
                    <div className="apl-inf__handle">@{applicant.handle}</div>
                  </div>
                </div>
              </td>
              <td>{applicant.campaign}</td>
              <td>
                <div className="apl-media-list">
                  {applicant.media.map((media) => {
                    const meta = MEDIA_META[media];
                    return (
                      <span
                        key={media}
                        className={`apl-media ${meta.cls}`}
                        title={meta.label}
                        aria-label={meta.label}
                      >
                        <i className={meta.icon} />
                      </span>
                    );
                  })}
                </div>
              </td>
              <td className="apl-num">{formatFollowers(applicant.followers)}</td>
              <td className="apl-time">{applicant.appliedAt}</td>
              {showStage && (
                <td
                  className="apl-stage-cell"
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
    </div>
  );
}
