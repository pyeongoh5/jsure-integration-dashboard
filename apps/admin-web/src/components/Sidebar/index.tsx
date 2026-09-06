import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ActiveProduct } from "@/components/Sidebar/ActiveProduct";
import { FooterUser } from "@/components/Sidebar/FooterUser";
import { findProductByPath } from "@/lib/navigation";
import { formatNumber } from "@i18n/admin";
import { useLanguage, useT } from "@/lib/i18n";
import {
  fetchAppliedCount,
  fetchPendingReviewCount,
  fetchPendingSettlementCount,
} from "@/domains/application";

export const Sidebar = () => {
  const t = useT();
  const { language } = useLanguage();
  const { pathname } = useLocation();
  const product = findProductByPath(pathname);
  const isInfluencerProduct = product.key === "influencer";

  const { data: pendingPayouts } = useQuery({
    queryKey: ["settlements-pending-count"],
    queryFn: fetchPendingSettlementCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isInfluencerProduct,
  });
  const { data: pendingApplicants } = useQuery({
    queryKey: ["applications-applied-count"],
    queryFn: fetchAppliedCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isInfluencerProduct,
  });
  const { data: pendingReviews } = useQuery({
    queryKey: ["submitted-posts-pending-count"],
    queryFn: fetchPendingReviewCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled: isInfluencerProduct,
  });

  const dynamicBadge = (to: string): ReactNode => {
    if (to === "/payouts" && pendingPayouts && pendingPayouts > 0) {
      return formatNumber(pendingPayouts, language);
    }
    if (to === "/applicants" && pendingApplicants && pendingApplicants > 0) {
      return formatNumber(pendingApplicants, language);
    }
    if (to === "/drafts" && pendingReviews && pendingReviews > 0) {
      return formatNumber(pendingReviews, language);
    }
    return undefined;
  };

  return (
    <aside className="admin__sidebar">
      <ActiveProduct product={product} />

      <nav className="admin__nav">
        {product.groups.map((group) => (
          <div key={group.title} className="admin__nav-group">
            <div className="admin__nav-title">{t(group.title)}</div>
            {group.items.map((item) => {
              const badge = dynamicBadge(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => "admin__nav-item" + (isActive ? " is-active" : "")}
                >
                  <span className="admin__nav-icon">
                    <i className={item.icon} />
                  </span>
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
