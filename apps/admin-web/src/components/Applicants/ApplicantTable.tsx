import { MEDIA_META, type Applicant } from "./types";

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
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

type Props = {
  items: Applicant[];
  selected: Set<string>;
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string) => void;
  onApprove: (a: Applicant) => void;
  onReject: (a: Applicant) => void;
  onUndo: (a: Applicant) => void;
};

export function ApplicantTable({
  items,
  selected,
  onToggleAll,
  onToggleOne,
  onApprove,
  onReject,
  onUndo,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="apl__card">
        <div className="apl__empty">해당 상태의 응모자가 없습니다.</div>
      </div>
    );
  }

  const allChecked = items.every((v) => selected.has(v.id));

  return (
    <div className="apl__card">
      <table className="apl__table">
        <thead>
          <tr>
            <th className="apl-check">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </th>
            <th>인플루언서</th>
            <th>캠페인</th>
            <th>매체</th>
            <th>팔로워</th>
            <th>참여율</th>
            <th>응모 시각</th>
            <th>액션</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className="apl-check">
                <input
                  type="checkbox"
                  checked={selected.has(a.id)}
                  onChange={() => onToggleOne(a.id)}
                />
              </td>
              <td>
                <div className="apl-inf">
                  <div
                    className="apl-inf__avatar"
                    style={{ background: pickAvatarColor(a.id) }}
                  >
                    {a.name[0]}
                  </div>
                  <div>
                    <div className="apl-inf__name">{a.name}</div>
                    <div className="apl-inf__handle">@{a.handle}</div>
                  </div>
                </div>
              </td>
              <td>{a.campaign}</td>
              <td>
                <div className="apl-media-list">
                  {a.media.map((m) => {
                    const meta = MEDIA_META[m];
                    return (
                      <span
                        key={m}
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
              <td className="apl-num">{formatFollowers(a.followers)}</td>
              <td className="apl-rate">{a.engagementRate.toFixed(1)}%</td>
              <td className="apl-time">{a.appliedAt}</td>
              <td>
                {a.status === "pending" ? (
                  <div className="apl-actions">
                    <button
                      type="button"
                      className="apl-action apl-action--approve"
                      onClick={() => onApprove(a)}
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      className="apl-action apl-action--reject"
                      onClick={() => onReject(a)}
                    >
                      반려
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="apl-action apl-action--undo"
                    onClick={() => onUndo(a)}
                  >
                    되돌리기
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
