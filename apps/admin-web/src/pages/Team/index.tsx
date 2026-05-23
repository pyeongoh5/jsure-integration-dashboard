import { useEffect, useMemo, useState } from "react";
import type { PublicAdminUser, AdminUserRole, AdminUserStatus } from "@jsure/shared";
import { listAdminUsers } from "@/lib/adminUsers";
import "./Team.css";

const ROLE_META: Record<AdminUserRole, { label: string; className: string }> = {
  OWNER: { label: "소유자(Owner)", className: "team-role--owner" },
  ADMIN: { label: "관리자(Admin)", className: "team-role--admin" },
  GUEST: { label: "게스트(Guest)", className: "team-role--guest" },
};

const STATUS_META: Record<AdminUserStatus, { label: string; className: string }> = {
  ACTIVE: { label: "활성", className: "team-status--active" },
  PENDING: { label: "초대 대기", className: "team-status--pending" },
  SUSPENDED: { label: "정지", className: "team-status--suspended" },
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
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] ?? "#6b7280";
}

function initialsOf(name: string | null, email: string): string {
  const fallback = email.split("@")[0] ?? email;
  const source = (name ?? fallback).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0];
  const second = parts[1];
  if (first && second) {
    return `${first[0] ?? ""}${second[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatLastActivity(iso: string | null, now: Date): string {
  if (!iso) return "활동 없음";
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "지금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  return then.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function Team() {
  const [users, setUsers] = useState<PublicAdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // let cancelled = false;
    listAdminUsers()
      .then((rows) => {
        setUsers(rows);
      })
      .catch(() => {
        setError("팀원 목록을 불러오지 못했습니다.");
      });

    // return () => {
    //   cancelled = true;
    // };
  }, []);

  const now = useMemo(() => new Date(), [users]);
  const activeCount = users?.filter((u) => u.status === "ACTIVE").length ?? 0;

  return (
    <div className="team">
      <div className="team__header">
        <div>
          <h1 className="team__title">팀원/권한</h1>
          <p className="team__subtitle">
            {users ? `${activeCount}명의 운영자가 활동 중` : "운영자 정보를 불러오는 중..."}
          </p>
        </div>
        <button type="button" className="team__invite">
          <i className="fa-solid fa-plus" />
          팀원 초대
        </button>
      </div>

      {error ? (
        <div className="team__state team__state--error">{error}</div>
      ) : !users ? (
        <div className="team__state">불러오는 중...</div>
      ) : users.length === 0 ? (
        <div className="team__state">등록된 팀원이 없습니다.</div>
      ) : (
        <div className="team__card">
          <table className="team__table">
            <thead>
              <tr>
                <th>이름</th>
                <th>이메일</th>
                <th>역할</th>
                <th>마지막 활동</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const role = ROLE_META[u.role];
                const status = STATUS_META[u.status];
                const displayName = u.name ?? u.email.split("@")[0] ?? u.email;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="team-name">
                        <span className="team-avatar" style={{ background: pickAvatarColor(u.id) }}>
                          {initialsOf(u.name, u.email)}
                        </span>
                        <span className="team-name__text">{displayName}</span>
                      </div>
                    </td>
                    <td className="team-email">{u.email}</td>
                    <td>
                      <span className={`team-badge ${role.className}`}>
                        <span className="team-badge__dot" />
                        {role.label}
                      </span>
                    </td>
                    <td className="team-activity">{formatLastActivity(u.lastSeenAt, now)}</td>
                    <td>
                      <span className={`team-badge ${status.className}`}>
                        <span className="team-badge__dot" />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
