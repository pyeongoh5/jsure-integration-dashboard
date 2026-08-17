import type { AdminTranslationKey } from "@i18n/admin";

export type NavItem = {
  to: string;
  label: AdminTranslationKey;
  icon: string;
  badge?: number | string;
};

export type NavGroup = {
  title: AdminTranslationKey;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    title: "nav.groups.operations",
    items: [
      { to: "/overview", label: "nav.items.dashboard", icon: "▦" },
      { to: "/campaigns", label: "nav.items.campaigns", icon: "◁", badge: 14 },
      { to: "/applicants", label: "nav.items.applicants", icon: "◎", badge: 23 },
      { to: "/drafts", label: "nav.items.drafts", icon: "✎", badge: 8 },
    ],
  },
  {
    title: "nav.groups.customers",
    items: [
      { to: "/influencers", label: "nav.items.influencers", icon: "♁", badge: "3,248" },
      { to: "/brands", label: "nav.items.brands", icon: "▲", badge: 42 },
    ],
  },
  {
    title: "nav.groups.finance",
    items: [
      { to: "/payouts", label: "nav.items.payouts", icon: "$", badge: 12 },
      { to: "/reports", label: "nav.items.reports", icon: "≡" },
    ],
  },
  {
    title: "nav.groups.system",
    items: [
      { to: "/notices", label: "nav.items.notices", icon: "✉" },
      { to: "/message-templates", label: "nav.items.messageTemplates", icon: "✎" },
      { to: "/team", label: "nav.items.team", icon: "♕" },
    ],
  },
];

export function findNavMatch(
  pathname: string,
): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV) {
    const item = group.items.find((navItem) => navItem.to === pathname);
    if (item) return { group, item };
  }
  return null;
}
