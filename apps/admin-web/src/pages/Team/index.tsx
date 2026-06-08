import { useEffect, useMemo, useState } from "react";
import type { PublicAdminUser, AdminUserRole, AdminUserStatus } from "@jsure/shared";
import {
  approveAdminUser,
  listAdminUsers,
  rejectAdminUser,
  updateAdminUserRole,
} from "@/lib/adminUsers";
import { getStoredUser } from "@/lib/auth";
import "./Team.css";

const ROLE_META: Record<AdminUserRole, { label: string; className: string }> = {
  OWNER: { label: "소유자(Owner)", className: "team-role--owner" },
  ADMIN: { label: "관리자(Admin)", className: "team-role--admin" },
  GUEST: { label: "게스트(Guest)", className: "team-role--guest" },
};

const STATUS_META: Record<AdminUserStatus, { label: string; className: string }> = {
  ACTIVE: { label: "활성", className: "team-status--active" },
  PENDING: { label: "승인 대기", className: "team-status--pending" },
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
  const [pendingId, setPendingId] = useState<string | null>(null);

  const currentUser = getStoredUser();
  const canManage =
    currentUser?.role === "OWNER" || currentUser?.role === "ADMIN";
  // 승인/반려 버튼이 필요한 PENDING 행이 하나라도 있을 때만 액션 컬럼 노출
  const hasPending =
    (users ?? []).some((u) => u.status === "PENDING") && canManage;

  useEffect(() => {
    listAdminUsers()
      .then((rows) => setUsers(rows))
      .catch(() => setError("팀원 목록을 불러오지 못했습니다."));
  }, []);

  const handleApprove = async (id: string) => {
    if (pendingId) return;
    setPendingId(id);
    try {
      const updated = await approveAdminUser(id);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === id ? updated : u)) : prev,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "승인에 실패했습니다");
    } finally {
      setPendingId(null);
    }
  };

  const handleRoleChange = async (id: string, role: AdminUserRole) => {
    if (pendingId) return;
    if (!window.confirm(`이 팀원의 권한을 "${ROLE_META[role].label}" 로 변경할까요?`)) {
      return;
    }
    setPendingId(id);
    try {
      const updated = await updateAdminUserRole(id, role);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === id ? updated : u)) : prev,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "권한 변경에 실패했습니다");
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (pendingId) return;
    if (!window.confirm("이 요청을 반려할까요? 반려된 계정은 정지 상태가 됩니다.")) {
      return;
    }
    setPendingId(id);
    try {
      const updated = await rejectAdminUser(id);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === id ? updated : u)) : prev,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "반려에 실패했습니다");
    } finally {
      setPendingId(null);
    }
  };

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
                {hasPending && <th aria-label="작업" />}
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
                      {canManage && currentUser?.id !== u.id ? (
                        <select
                          className={`team-role-select ${role.className}`}
                          value={u.role}
                          disabled={pendingId === u.id}
                          onChange={(event) =>
                            handleRoleChange(
                              u.id,
                              event.target.value as AdminUserRole,
                            )
                          }
                        >
                          {currentUser?.role === "OWNER" && (
                            <option value="OWNER">{ROLE_META.OWNER.label}</option>
                          )}
                          <option value="ADMIN">{ROLE_META.ADMIN.label}</option>
                          <option value="GUEST">{ROLE_META.GUEST.label}</option>
                        </select>
                      ) : (
                        <span className={`team-badge ${role.className}`}>
                          <span className="team-badge__dot" />
                          {role.label}
                        </span>
                      )}
                    </td>
                    <td className="team-activity">{formatLastActivity(u.lastSeenAt, now)}</td>
                    <td>
                      <span className={`team-badge ${status.className}`}>
                        <span className="team-badge__dot" />
                        {status.label}
                      </span>
                    </td>
                    {hasPending && (
                      <td className="team-actions">
                        {u.status === "PENDING" ? (
                          <>
                            <button
                              type="button"
                              className="team-btn team-btn--primary"
                              onClick={() => handleApprove(u.id)}
                              disabled={pendingId === u.id}
                            >
                              승인
                            </button>
                            <button
                              type="button"
                              className="team-btn team-btn--danger"
                              onClick={() => handleReject(u.id)}
                              disabled={pendingId === u.id}
                            >
                              반려
                            </button>
                          </>
                        ) : null}
                      </td>
                    )}
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
