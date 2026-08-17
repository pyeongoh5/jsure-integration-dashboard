import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { AdminTranslationKey } from "@i18n/admin";
import { Logo } from "@/components/Sidebar/Logo";
import { FooterUser } from "@/components/Sidebar/FooterUser";
import { useT } from "@/lib/i18n";
import {
  fetchAppliedCount,
  fetchPendingReviewCount,
  fetchPendingSettlementCount,
} from "@/domains/application";

type NavItem = { to: string; label: AdminTranslationKey; icon: ReactNode; badge?: ReactNode };
type NavGroup = { title: AdminTranslationKey; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    title: "nav.groups.operations",
    items: [
      {
        to: "/",
        label: "nav.items.dashboard",
        icon: <i className="fa-solid fa-table-cells-large" />,
      },
      {
        to: "/campaigns",
        label: "nav.items.campaigns",
        icon: <i className="fa-solid fa-bullhorn" />,
      },
      {
        to: "/applicants",
        label: "nav.items.applicants",
        icon: <i className="fa-solid fa-user-check" />,
      },
      { to: "/drafts", label: "nav.items.drafts", icon: <i className="fa-solid fa-file-pen" /> },
    ],
  },
  {
    title: "nav.groups.customers",
    items: [
      {
        to: "/influencers",
        label: "nav.items.influencers",
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
    title: "nav.groups.finance",
    items: [
      {
        to: "/payouts",
        label: "nav.items.payouts",
        icon: <i className="fa-solid fa-money-check-dollar" />,
      },
      {
        to: "/reports",
        label: "nav.items.reports",
        icon: <i className="fa-solid fa-chart-line" />,
      },
    ],
  },
  {
    title: "nav.groups.system",
    items: [
      { to: "/notices", label: "nav.items.notices", icon: <i className="fa-solid fa-bullhorn" /> },
      {
        to: "/message-templates",
        label: "nav.items.messageTemplates",
        icon: <i className="fa-solid fa-comment-dots" />,
      },
      { to: "/team", label: "nav.items.team", icon: <i className="fa-solid fa-user-plus" /> },
    ],
  },
];

export const Sidebar = () => {
  const t = useT();
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
            <div className="admin__nav-title">{t(group.title)}</div>
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
                  <span className="admin__nav-label">{t(item.label)}</span>
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
