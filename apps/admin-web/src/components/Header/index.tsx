import { useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/Breadcrumb";

export const Header = () => {
  const navigate = useNavigate();
  return (
    <header className="admin__topbar">
      <Breadcrumb />
      <div className="admin__topbar-actions">
        {/* <button className="admin__icon-btn" aria-label="알림">
          🔔
        </button>
        <button className="admin__btn admin__btn--ghost">✓ 내보내기</button> */}
        <button
          type="button"
          className="admin__btn admin__btn--primary"
          onClick={() => navigate("/campaigns/new")}
        >
          + 새 캠페인
        </button>
      </div>
    </header>
  );
};
