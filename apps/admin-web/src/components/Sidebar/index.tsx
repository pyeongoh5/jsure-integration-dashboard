import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Logo } from "@/components/Sidebar/Logo";
import { SidebarSearch } from "@/components/Sidebar/SidebarSearch";
import { FooterUser } from "@/components/Sidebar/FooterUser";

type NavItem = { to: string; label: string; icon: ReactNode; badge?: number | string };
type NavGroup = { title: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "운영",
    items: [
      { to: "/", label: "대시보드", icon: <i className="fa-solid fa-table-cells-large" /> },
      {
        to: "/campaigns",
        label: "캠페인 관리",
        icon: <i className="fa-solid fa-bullhorn" />,
        badge: 14,
      },
      {
        to: "/applicants",
        label: "응모자 관리",
        icon: <i className="fa-solid fa-user-check" />,
        badge: 23,
      },
      { to: "/drafts", label: "초안 검토", icon: <i className="fa-solid fa-file-pen" />, badge: 8 },
      {
        to: "/monitoring",
        label: "게시 모니터링",
        icon: <i className="fa-regular fa-circle-check" />,
      },
    ],
  },
  {
    title: "고객",
    items: [
      {
        to: "/influencers",
        label: "인플루언서",
        icon: <i className="fa-solid fa-user-group" />,
        badge: "3,248",
      },
      {
        to: "/brands",
        label: "광고주(브랜드)",
        icon: <i className="fa-solid fa-building" />,
        badge: 42,
      },
    ],
  },
  {
    title: "재무",
    items: [
      {
        to: "/payouts",
        label: "정산 관리",
        icon: <i className="fa-solid fa-money-check-dollar" />,
        badge: 12,
      },
      { to: "/reports", label: "리포트", icon: <i className="fa-solid fa-chart-line" /> },
    ],
  },
  {
    title: "시스템",
    items: [
      { to: "/team", label: "팀원/권한", icon: <i className="fa-solid fa-user-plus" /> },
      { to: "/settings", label: "설정", icon: <i className="fa-solid fa-gear" /> },
    ],
  },
];

export const Sidebar = () => {
  return (
    <aside className="admin__sidebar">
      <Logo />

      <SidebarSearch />

      <nav className="admin__nav">
        {NAV.map((group) => (
          <div key={group.title} className="admin__nav-group">
            <div className="admin__nav-title">{group.title}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) => "admin__nav-item" + (isActive ? " is-active" : "")}
              >
                <span className="admin__nav-icon">{item.icon}</span>
                <span className="admin__nav-label">{item.label}</span>
                {item.badge !== undefined && <span className="admin__nav-badge">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <FooterUser />
    </aside>
  );
};
