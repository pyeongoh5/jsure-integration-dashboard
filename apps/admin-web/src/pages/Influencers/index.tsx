import { useEffect, useMemo, useState } from "react";
import type { AdminInfluencer, SnsType } from "@jsure/shared";
import { listInfluencers } from "@/lib/influencers";
import "./Influencers.css";

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
};

const SNS_CLASS: Record<SnsType, string> = {
  INSTAGRAM: "inf-sns--ig",
  TIKTOK: "inf-sns--tt",
  X: "inf-sns--x",
  YOUTUBE: "inf-sns--yt",
};

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${parseFloat((n / 1_000).toFixed(1))}K`;
  return String(n);
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
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; rows: AdminInfluencer[] }
  | { kind: "error"; message: string };

export function Influencers() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    listInfluencers()
      .then((rows) => {
        if (!cancelled) setState({ kind: "ready", rows });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "인플루언서 목록을 불러올 수 없습니다.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    if (state.kind !== "ready") return [];
    const q = query.trim().toLowerCase();
    if (!q) return state.rows;
    return state.rows.filter((r) =>
      `${r.name} ${r.email} ${r.snsAccounts.map((s) => s.handle).join(" ")}`
        .toLowerCase()
        .includes(q),
    );
  }, [state, query]);

  return (
    <div className="inf">
      <div className="inf__header">
        <div>
          <h1 className="inf__title">인플루언서</h1>
          <p className="inf__subtitle">
            {state.kind === "ready" ? `총 ${state.rows.length}명` : "목록을 불러오는 중..."}
          </p>
        </div>
        <div className="inf__search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="이름, 이메일, 핸들 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className="inf__empty">불러오는 중…</div>
      ) : state.kind === "error" ? (
        <div className="inf__empty">
          {state.message}{" "}
          <button type="button" className="inf__retry" onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="inf__empty">조건에 맞는 인플루언서가 없습니다.</div>
      ) : (
        <div className="inf__card">
          <table className="inf__table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일 / 연락처</th>
                <th>SNS 계정</th>
                <th>상태</th>
                <th>가입일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="inf-name">
                      <span className="inf-avatar" style={{ background: pickAvatarColor(r.id) }}>
                        {r.name[0]}
                      </span>
                      <div>
                        <div className="inf-name__text">{r.name}</div>
                        {r.nameKana && <div className="inf-name__sub">{r.nameKana}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="inf-contact">{r.email}</div>
                    <div className="inf-contact inf-contact--sub">{r.phone}</div>
                  </td>
                  <td>
                    {r.snsAccounts.length === 0 ? (
                      <span className="inf-empty-cell">—</span>
                    ) : (
                      <div className="inf-sns-list">
                        {r.snsAccounts.map((s) => (
                          <span
                            key={s.snsType}
                            className={`inf-sns ${SNS_CLASS[s.snsType]}`}
                            title={`@${s.handle}`}
                          >
                            <i className={SNS_ICON[s.snsType]} />
                            <span className="inf-sns__handle">@{s.handle}</span>
                            <span className="inf-sns__count">
                              {formatFollowers(s.followerCount)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`inf-status inf-status--${r.status.toLowerCase()}`}>
                      {r.status === "ACTIVE" ? "활성" : "정지"}
                    </span>
                  </td>
                  <td className="inf-date">
                    {new Date(r.createdAt).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
