export type NavItem = {
  to: string;
  label: string;
  icon: string;
  badge?: number | string;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV: NavGroup[] = [
  {
    title: "운영",
    items: [
      { to: "/overview", label: "대시보드", icon: "▦" },
      { to: "/campaigns", label: "캠페인 관리", icon: "◁", badge: 14 },
      { to: "/applicants", label: "응모자 관리", icon: "◎", badge: 23 },
      { to: "/drafts", label: "검토", icon: "✎", badge: 8 },
    ],
  },
  {
    title: "고객",
    items: [
      { to: "/influencers", label: "인플루언서", icon: "♁", badge: "3,248" },
      { to: "/brands", label: "광고주(브랜드)", icon: "▲", badge: 42 },
    ],
  },
  {
    title: "재무",
    items: [
      { to: "/payouts", label: "정산 관리", icon: "$", badge: 12 },
      { to: "/reports", label: "리포트", icon: "≡" },
    ],
  },
  {
    title: "시스템",
    items: [
      { to: "/notices", label: "공지사항", icon: "✉" },
      { to: "/message-templates", label: "메시지 템플릿", icon: "✎" },
      { to: "/team", label: "팀원/권한", icon: "♕" },
    ],
  },
];

export function findNavMatch(
  pathname: string,
): { group: NavGroup; item: NavItem } | null {
  for (const group of NAV) {
    const item = group.items.find((i) => i.to === pathname);
    if (item) return { group, item };
  }
  return null;
}
