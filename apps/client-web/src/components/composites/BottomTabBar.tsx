import { NavLink } from "react-router-dom";
import { useUnreadNoticeCount } from "@/domains/notice";
import { t } from "@/i18n";
import styles from "./BottomTabBar.module.css";

type Tab = {
  to: string;
  icon: string;
  label: string;
  end: boolean;
};

const TABS: readonly Tab[] = [
  { to: "/", icon: "fa-magnifying-glass", label: t("components.bottomTab.search"), end: true },
  { to: "/applications", icon: "fa-clipboard-check", label: t("components.bottomTab.applications"), end: false },
  { to: "/notices", icon: "fa-bell", label: t("components.bottomTab.notices"), end: false },
  { to: "/me", icon: "fa-user", label: t("components.bottomTab.myPage"), end: false },
];

export function BottomTabBar() {
  const unreadNoticeCount = useUnreadNoticeCount();

  return (
    <nav className={styles.bar}>
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [styles.item, isActive ? styles.itemActive : ""].filter(Boolean).join(" ")
          }
        >
          <span className={styles.iconWrap}>
            <i className={`fa-solid ${tab.icon}`} aria-hidden />
            {tab.to === "/notices" && unreadNoticeCount > 0 ? (
              <span className={styles.badge}>
                {unreadNoticeCount > 99 ? "99+" : unreadNoticeCount}
              </span>
            ) : null}
          </span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
