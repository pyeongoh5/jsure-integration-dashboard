import { Link } from "react-router-dom";

export const Logo = () => (
  <Link to="/" className="admin__brand-link">
    <div className="admin__brand">
      <div className="admin__logo">R</div>
      <div className="admin__brand-text">
        <div className="admin__brand-name">Reachly</div>
        <span className="admin__brand-role">ADMIN</span>
      </div>
    </div>
  </Link>
)