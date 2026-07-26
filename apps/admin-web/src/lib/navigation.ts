import type { AdminTranslationKey } from "@i18n/admin";

/**
 * 어드민 네비게이션의 단일 소스.
 *
 * 어드민은 서로 다른 두 제품을 한 화면에서 운영한다.
 * - `influencer`: 기존 J-SURE 인플루언서 매칭 (대시보드 API `@jsure/api`)
 * - `jwin`: X 인스턴트윈 캠페인 J-WIN (`@jsure/jwin-api`, D-10 으로 인증만 공유)
 *
 * 제품마다 사이드바 메뉴가 완전히 다르므로, 최상단 스위처에서 제품을 고르고
 * 사이드바는 선택된 제품의 그룹만 보여준다. 기존 인플루언서 경로는 그대로 두고
 * J-WIN 만 `/jwin` prefix 아래에 둔다 (기존 북마크 유지).
 *
 * label/title/description 은 전부 i18n 키다. 렌더 시점에 번역한다.
 */

export type ProductKey = "influencer" | "jwin";

export type NavItem = {
  to: string;
  label: AdminTranslationKey;
  /** Font Awesome 클래스 (예: "fa-solid fa-bullhorn") */
  icon: string;
  badge?: string | number;
};

export type NavGroup = {
  title: AdminTranslationKey;
  items: NavItem[];
};

export type Product = {
  key: ProductKey;
  /** 스위처 버튼에 노출되는 이름 */
  label: AdminTranslationKey;
  /** 스위처 버튼 보조 설명 */
  description?: AdminTranslationKey;
  icon: string;
  /** 이 prefix 로 시작하는 경로는 해당 제품에 속한다. 기본 제품은 null */
  pathPrefix: string | null;
  /** 스위처 클릭 시 이동할 경로 */
  homePath: string;
  groups: NavGroup[];
};

/** prefix 가 없는 기본 제품. 어느 제품에도 속하지 않는 경로는 전부 여기로 귀속된다. */
const INFLUENCER_PRODUCT: Product = {
  key: "influencer",
  label: "nav.products.influencer",
  description: "nav.products.influencerDescription",
  icon: "fa-solid fa-user-group",
  pathPrefix: null,
  homePath: "/overview",
  groups: [
    {
      title: "nav.groups.operations",
      items: [
        { to: "/overview", label: "nav.items.dashboard", icon: "fa-solid fa-table-cells-large" },
        { to: "/campaigns", label: "nav.items.campaigns", icon: "fa-solid fa-bullhorn" },
        { to: "/applicants", label: "nav.items.applicants", icon: "fa-solid fa-user-check" },
        { to: "/drafts", label: "nav.items.drafts", icon: "fa-solid fa-file-pen" },
      ],
    },
    {
      title: "nav.groups.customers",
      items: [
        { to: "/influencers", label: "nav.items.influencers", icon: "fa-solid fa-user-group" },
      ],
    },
    {
      title: "nav.groups.finance",
      items: [
        { to: "/payouts", label: "nav.items.payouts", icon: "fa-solid fa-money-check-dollar" },
        { to: "/reports", label: "nav.items.reports", icon: "fa-solid fa-chart-line" },
      ],
    },
    {
      title: "nav.groups.system",
      items: [
        { to: "/notices", label: "nav.items.notices", icon: "fa-solid fa-bullhorn" },
        {
          to: "/message-templates",
          label: "nav.items.messageTemplates",
          icon: "fa-solid fa-comment-dots",
        },
        { to: "/team", label: "nav.items.team", icon: "fa-solid fa-user-plus" },
      ],
    },
  ],
};

const JWIN_PRODUCT: Product = {
  key: "jwin",
  label: "nav.products.jwin",
  description: "nav.products.jwinDescription",
  icon: "fa-solid fa-ticket",
  pathPrefix: "/jwin",
  homePath: "/jwin/campaigns",
  groups: [
    {
      title: "nav.groups.operations",
      items: [
        { to: "/jwin/campaigns", label: "nav.items.campaigns", icon: "fa-solid fa-bullhorn" },
        { to: "/jwin/winners", label: "nav.items.jwinWinners", icon: "fa-solid fa-trophy" },
      ],
    },
    {
      title: "nav.groupsJwin.prizes",
      items: [{ to: "/jwin/prizes", label: "nav.items.jwinPrizes", icon: "fa-solid fa-gift" }],
    },
    {
      title: "nav.groupsJwin.analytics",
      items: [{ to: "/jwin/stats", label: "nav.items.jwinStats", icon: "fa-solid fa-chart-line" }],
    },
  ],
};

export const PRODUCTS: Product[] = [INFLUENCER_PRODUCT, JWIN_PRODUCT];

/** 경로가 속한 제품. prefix 가 있는 제품을 먼저 보고, 없으면 기본 제품. */
export function findProductByPath(pathname: string): Product {
  const matched = PRODUCTS.find(
    (product) =>
      product.pathPrefix !== null &&
      (pathname === product.pathPrefix || pathname.startsWith(`${product.pathPrefix}/`)),
  );
  return matched ?? INFLUENCER_PRODUCT;
}

export function findNavMatch(
  pathname: string,
): { product: Product; group: NavGroup; item: NavItem } | null {
  const product = findProductByPath(pathname);
  for (const group of product.groups) {
    const item = group.items.find((navItem) => navItem.to === pathname);
    if (item) return { product, group, item };
  }
  return null;
}
