import { Outlet } from "react-router-dom";
import "./AdminLayout.css";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

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
    </div>
  );
}
