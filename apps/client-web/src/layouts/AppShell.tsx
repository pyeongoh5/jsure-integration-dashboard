import { Outlet } from "react-router-dom";
import { BottomTabBar } from "../components/layout/BottomTabBar";
import { RequireAuth } from "../components/layout/RequireAuth";
import "./AppShell.css";

export function AppShell() {
  return (
    <RequireAuth>
      <div className="app-shell">
        <main className="app-shell__main">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </RequireAuth>
  );
}
