import { Outlet } from "react-router-dom";
import "./AuthShell.css";

export function AuthShell() {
  return (
    <div className="auth-shell">
      <header className="auth-shell__brand">
        <div className="auth-shell__title">Reachly</div>
        <div className="auth-shell__subtitle">influencer</div>
      </header>
      <main className="auth-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
