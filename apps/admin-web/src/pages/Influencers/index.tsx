import { useEffect, useMemo, useState } from "react";
import type { AdminInfluencer, SnsType } from "@jsure/shared";
import { listInfluencers } from "@/domains/influencer";
import { BroadcastDialog } from "@/domains/broadcast";
import styles from "./Influencers.module.css";

const SNS_ICON: Record<SnsType, string> = {
  INSTAGRAM: "fa-brands fa-instagram",
  TIKTOK: "fa-brands fa-tiktok",
  X: "fa-brands fa-x-twitter",
  YOUTUBE: "fa-brands fa-youtube",
};

const SNS_CLASS: Record<SnsType, string | undefined> = {
  INSTAGRAM: styles.snsIg,
  TIKTOK: styles.snsTt,
  X: styles.snsX,
  YOUTUBE: styles.snsYt,
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
  const [broadcastOpen, setBroadcastOpen] = useState(false);

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
    <div className={styles.inf}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>인플루언서</h1>
          <p className={styles.subtitle}>
            {state.kind === "ready" ? `총 ${state.rows.length}명` : "목록을 불러오는 중..."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="이름, 이메일, 핸들 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.broadcastBtn}
            onClick={() => setBroadcastOpen(true)}
            disabled={state.kind !== "ready"}
          >
            <i className="fa-regular fa-paper-plane" /> 메시지 발송
          </button>
        </div>
      </div>

      {state.kind === "loading" ? (
        <div className={styles.empty}>불러오는 중…</div>
      ) : state.kind === "error" ? (
        <div className={styles.empty}>
          {state.message}{" "}
          <button type="button" className={styles.retry} onClick={() => setReloadKey((k) => k + 1)}>
            다시 시도
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>조건에 맞는 인플루언서가 없습니다.</div>
      ) : (
        <div className={styles.card}>
          <table className={styles.table}>
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
                    <div className={styles.name}>
                      <span className={styles.avatar} style={{ background: pickAvatarColor(r.id) }}>
                        {r.name[0]}
                      </span>
                      <div>
                        <div className={styles.nameText}>{r.name}</div>
                        {r.nameKana && <div className={styles.nameSub}>{r.nameKana}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className={styles.contact}>{r.email}</div>
                    <div className={`${styles.contact} ${styles.contactSub}`}>{r.phone}</div>
                  </td>
                  <td>
                    {r.snsAccounts.length === 0 ? (
                      <span className={styles.emptyCell}>—</span>
                    ) : (
                      <div className={styles.snsList}>
                        {r.snsAccounts.map((s) => (
                          <span
                            key={s.snsType}
                            className={`${styles.sns} ${SNS_CLASS[s.snsType]}`}
                            title={`@${s.handle}`}
                          >
                            <i className={SNS_ICON[s.snsType]} />
                            <span className={styles.snsHandle}>@{s.handle}</span>
                            <span className={styles.snsCount}>
                              {formatFollowers(s.followerCount)}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.status} ${
                        r.status === "ACTIVE" ? styles.statusActive : styles.statusSuspended
                      }`}
                    >
                      {r.status === "ACTIVE" ? "활성" : "정지"}
                    </span>
                  </td>
                  <td className={styles.date}>
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

      <BroadcastDialog
        open={broadcastOpen}
        candidates={filtered}
        onClose={() => setBroadcastOpen(false)}
      />
    </div>
  );
}
