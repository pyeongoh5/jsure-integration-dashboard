import { Outlet } from "react-router-dom";
import "./AdminLayout.css";
import { ProductSwitcher } from "@/components/ProductSwitcher";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { BroadcastProgressDock } from "@/domains/broadcast";

export function AdminLayout() {
  return (
    <div className="admin">
      <ProductSwitcher />

      <div className="admin__body">
        <Sidebar />

        <div className="admin__main">
          <Header />

          <main className="admin__content">
            <Outlet />
          </main>
        </div>
      </div>

      <BroadcastProgressDock />
    </div>
  );
}
