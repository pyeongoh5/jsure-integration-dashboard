import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Logo } from "@/components/Sidebar/Logo";
import { FooterUser } from "@/components/Sidebar/FooterUser";
import {
  fetchAppliedCount,
  fetchPendingReviewCount,
  fetchPendingSettlementCount,
} from "@/domains/application";

type NavItem = { to: string; label: string; icon: ReactNode; badge?: ReactNode };
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
      },
      {
        to: "/applicants",
        label: "응모자 관리",
        icon: <i className="fa-solid fa-user-check" />,
      },
      { to: "/drafts", label: "검토", icon: <i className="fa-solid fa-file-pen" /> },
    ],
  },
  {
    title: "고객",
    items: [
      {
        to: "/influencers",
        label: "인플루언서",
        icon: <i className="fa-solid fa-user-group" />,
      },
      // {
      //   to: "/brands",
      //   label: "광고주(브랜드)",
      //   icon: <i className="fa-solid fa-building" />,
      // },
    ],
  },
  {
    title: "재무",
    items: [
      {
        to: "/payouts",
        label: "정산 관리",
        icon: <i className="fa-solid fa-money-check-dollar" />,
      },
      { to: "/reports", label: "리포트", icon: <i className="fa-solid fa-chart-line" /> },
    ],
  },
  {
    title: "시스템",
    items: [
      { to: "/notices", label: "공지사항", icon: <i className="fa-solid fa-bullhorn" /> },
      {
        to: "/message-templates",
        label: "메시지 템플릿",
        icon: <i className="fa-solid fa-comment-dots" />,
      },
      { to: "/team", label: "팀원/권한", icon: <i className="fa-solid fa-user-plus" /> },
    ],
  },
];

export const Sidebar = () => {
  const { data: pendingPayouts } = useQuery({
    queryKey: ["settlements-pending-count"],
    queryFn: fetchPendingSettlementCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: pendingApplicants } = useQuery({
    queryKey: ["applications-applied-count"],
    queryFn: fetchAppliedCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const { data: pendingReviews } = useQuery({
    queryKey: ["submitted-posts-pending-count"],
    queryFn: fetchPendingReviewCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const dynamicBadge = (to: string): ReactNode => {
    if (to === "/payouts" && pendingPayouts && pendingPayouts > 0) {
      return pendingPayouts;
    }
    if (to === "/applicants" && pendingApplicants && pendingApplicants > 0) {
      return pendingApplicants;
    }
    if (to === "/drafts" && pendingReviews && pendingReviews > 0) {
      return pendingReviews;
    }
    return undefined;
  };

  return (
    <aside className="admin__sidebar">
      <Logo />

      <nav className="admin__nav">
        {NAV.map((group) => (
          <div key={group.title} className="admin__nav-group">
            <div className="admin__nav-title">{group.title}</div>
            {group.items.map((item) => {
              const badge = item.badge ?? dynamicBadge(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) => "admin__nav-item" + (isActive ? " is-active" : "")}
                >
                  <span className="admin__nav-icon">{item.icon}</span>
                  <span className="admin__nav-label">{item.label}</span>
                  {badge !== undefined && <span className="admin__nav-badge">{badge}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <FooterUser />
    </aside>
  );
};
