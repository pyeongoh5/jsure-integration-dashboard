import { useEffect, useMemo, useState } from "react";
import type { PublicAdminUser, AdminUserRole, AdminUserStatus } from "@jsure/shared";
import {
  approveAdminUser,
  listAdminUsers,
  rejectAdminUser,
  updateAdminUserRole,
} from "@/domains/team";
import { getStoredUser } from "@/domains/auth";
import { ScrollTable } from "@/components/composites";
import { Button } from "@/components/ui";
import { useLanguage, useT } from "@/lib/i18n";
import type { AdminTranslationKey } from "@i18n/admin";
import styles from "./Team.module.css";

const ROLE_META: Record<
  AdminUserRole,
  { labelKey: AdminTranslationKey; className: string | undefined }
> = {
  OWNER: { labelKey: "pages.team.roles.owner", className: styles.roleOwner },
  ADMIN: { labelKey: "pages.team.roles.admin", className: styles.roleAdmin },
  GUEST: { labelKey: "pages.team.roles.guest", className: styles.roleGuest },
};

const STATUS_META: Record<
  AdminUserStatus,
  { labelKey: AdminTranslationKey; className: string | undefined }
> = {
  ACTIVE: { labelKey: "common.active", className: styles.statusActive },
  PENDING: { labelKey: "pages.team.statusPending", className: styles.statusPending },
  SUSPENDED: { labelKey: "common.suspended", className: styles.statusSuspended },
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

type TranslateFn = (
  key: AdminTranslationKey,
  params?: Record<string, string | number>,
) => string;

function formatLastActivity(
  iso: string | null,
  now: Date,
  t: TranslateFn,
  language: string,
): string {
  if (!iso) return t("pages.team.time.none");
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("pages.team.time.justNow");
  if (minutes < 60) return t("pages.team.time.minutesAgo", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("pages.team.time.hoursAgo", { hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t("pages.team.time.yesterday");
  if (days < 7) return t("pages.team.time.daysAgo", { days });
  return then.toLocaleDateString(language, { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function Team() {
  const t = useT();
  const { language } = useLanguage();
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
      .catch(() => setError(t("pages.team.loadFailed")));
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
      window.alert(err instanceof Error ? err.message : t("pages.team.approveFailed"));
    } finally {
      setPendingId(null);
    }
  };

  const handleRoleChange = async (id: string, role: AdminUserRole) => {
    if (pendingId) return;
    const roleLabel = t(ROLE_META[role].labelKey);
    if (!window.confirm(t("pages.team.roleChangeConfirm", { role: roleLabel }))) {
      return;
    }
    setPendingId(id);
    try {
      const updated = await updateAdminUserRole(id, role);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === id ? updated : u)) : prev,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("pages.team.roleChangeFailed"));
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (pendingId) return;
    if (!window.confirm(t("pages.team.rejectConfirm"))) {
      return;
    }
    setPendingId(id);
    try {
      const updated = await rejectAdminUser(id);
      setUsers((prev) =>
        prev ? prev.map((u) => (u.id === id ? updated : u)) : prev,
      );
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t("pages.team.rejectFailed"));
    } finally {
      setPendingId(null);
    }
  };

  const now = useMemo(() => new Date(), [users]);
  const activeCount = users?.filter((u) => u.status === "ACTIVE").length ?? 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t("nav.items.team")}</h1>
          <p className={styles.subtitle}>
            {users
              ? t("pages.team.activeSummary", { count: activeCount })
              : t("pages.team.loadingSummary")}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          iconLeft={<i className="fa-solid fa-plus" aria-hidden="true" />}
        >
          {t("pages.team.invite")}
        </Button>
      </div>

      {error ? (
        <div className={`${styles.state} ${styles.stateError}`}>{error}</div>
      ) : !users ? (
        <div className={styles.state}>{t("common.loading")}</div>
      ) : users.length === 0 ? (
        <div className={styles.state}>{t("pages.team.emptyMembers")}</div>
      ) : (
        <div className={styles.card}>
          <ScrollTable>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("common.email")}</th>
                <th>{t("pages.team.table.role")}</th>
                <th>{t("pages.team.table.lastActivity")}</th>
                <th>{t("common.status")}</th>
                {hasPending && <th aria-label={t("pages.team.table.actionsAria")} />}
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
                      <div className={styles.name}>
                        <span className={styles.avatar} style={{ background: pickAvatarColor(u.id) }}>
                          {initialsOf(u.name, u.email)}
                        </span>
                        <span className={styles.nameText}>{displayName}</span>
                      </div>
                    </td>
                    <td className={styles.email}>{u.email}</td>
                    <td>
                      {canManage && currentUser?.id !== u.id ? (
                        <select
                          className={`${styles.roleSelect} ${role.className}`}
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
                            <option value="OWNER">{t(ROLE_META.OWNER.labelKey)}</option>
                          )}
                          <option value="ADMIN">{t(ROLE_META.ADMIN.labelKey)}</option>
                          <option value="GUEST">{t(ROLE_META.GUEST.labelKey)}</option>
                        </select>
                      ) : (
                        <span className={`${styles.badge} ${role.className}`}>
                          <span className={styles.badgeDot} />
                          {t(role.labelKey)}
                        </span>
                      )}
                    </td>
                    <td className={styles.activity}>
                      {formatLastActivity(u.lastSeenAt, now, t, language)}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${status.className}`}>
                        <span className={styles.badgeDot} />
                        {t(status.labelKey)}
                      </span>
                    </td>
                    {hasPending && (
                      <td className={styles.actions}>
                        {u.status === "PENDING" ? (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleApprove(u.id)}
                              disabled={pendingId === u.id}
                            >
                              {t("domains.application.applicants.actions.approve")}
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleReject(u.id)}
                              disabled={pendingId === u.id}
                            >
                              {t("domains.application.applicants.actions.reject")}
                            </Button>
                          </>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ScrollTable>
        </div>
      )}
    </div>
  );
}
