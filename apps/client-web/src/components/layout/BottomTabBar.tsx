import { NavLink } from "react-router-dom";
import "./BottomTabBar.css";

const TABS = [
  { to: "/", icon: "fa-magnifying-glass", label: "探す", end: true },
  { to: "/applications", icon: "fa-clipboard-check", label: "応募内訳", end: false },
  { to: "/me", icon: "fa-user", label: "マイページ", end: false },
];

export function BottomTabBar() {
  return (
    <nav className="bottom-tab">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `bottom-tab__item ${isActive ? "bottom-tab__item--active" : ""}`
          }
        >
          <i className={`fa-solid ${t.icon}`} aria-hidden />
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
