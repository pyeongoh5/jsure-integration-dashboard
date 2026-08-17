import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminTranslationKey } from "@i18n/admin";
import { getStoredUser, logout } from "@/domains/auth";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";
import { useT } from "@/lib/i18n";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return email.slice(0, 2).toUpperCase();
}

const ROLE_LABEL_KEY: Record<"GUEST" | "ADMIN" | "OWNER", AdminTranslationKey> = {
  GUEST: "common.roles.guest",
  ADMIN: "common.roles.admin",
  OWNER: "common.roles.owner",
};

export const FooterUser = () => {
  const t = useT();
  const navigate = useNavigate();
  const user = getStoredUser();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleConfirm() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setLoggingOut(false);
      setConfirmOpen(false);
    }
  }

  if (!user) {
    return (
      <div className="admin__user">
        <div className="admin__avatar">?</div>
        <div>
          <div className="admin__user-name">{t("sidebar.footer.guest")}</div>
          <div className="admin__user-role">{t("sidebar.footer.loginRequired")}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="admin__user">
        <div className="admin__avatar">{initials(user.name, user.email)}</div>
        <div className="admin__user-info">
          <div className="admin__user-name">{user.name ?? user.email}</div>
          <div className="admin__user-role">{t(ROLE_LABEL_KEY[user.role])}</div>
        </div>
        <button
          type="button"
          className="admin__user-logout"
          onClick={() => setConfirmOpen(true)}
          aria-label={t("sidebar.footer.logout")}
          title={t("sidebar.footer.logout")}
        >
          ⎋
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title={t("sidebar.footer.logoutConfirmTitle")}
        subtitle={t("sidebar.footer.logoutConfirmSubtitle")}
        confirmLabel={t("sidebar.footer.logout")}
        cancelLabel={t("common.cancel")}
        tone="danger"
        busy={loggingOut}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
