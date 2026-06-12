import { Outlet } from "react-router-dom";
import "./AdminLayout.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BroadcastProgressDock } from "@/domains/broadcast";

export function AdminLayout() {
  return (
    <div className="admin">
      <Sidebar />

      <div className="admin__main">
        <Header />

        <main className="admin__content">
          <Outlet />
        </main>
      </div>

      <BroadcastProgressDock />
    </div>
  );
}
