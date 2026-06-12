import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getStoredUser, logout } from "@/domains/auth";
import { ConfirmDialog } from "@/components/composites/ConfirmDialog";

function initials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  }
  return email.slice(0, 2).toUpperCase();
}

const ROLE_LABEL: Record<"GUEST" | "ADMIN" | "OWNER", string> = {
  GUEST: "게스트",
  ADMIN: "Admin",
  OWNER: "Owner",
};

export const FooterUser = () => {
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
          <div className="admin__user-name">게스트</div>
          <div className="admin__user-role">로그인이 필요합니다</div>
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
          <div className="admin__user-role">{ROLE_LABEL[user.role]}</div>
        </div>
        <button
          type="button"
          className="admin__user-logout"
          onClick={() => setConfirmOpen(true)}
          aria-label="로그아웃"
          title="로그아웃"
        >
          ⎋
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="로그아웃 하시겠습니까?"
        subtitle="현재 기기에서 세션이 종료되며, 다시 사용하려면 로그인이 필요합니다."
        confirmLabel="로그아웃"
        cancelLabel="취소"
        tone="danger"
        busy={loggingOut}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};
