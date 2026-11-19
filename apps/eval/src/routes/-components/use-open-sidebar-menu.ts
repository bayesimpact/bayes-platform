import { useMatches } from "@tanstack/react-router"

/** A menu of the sidebar that folds: an agent's campaigns, or those the person tests or reviews. */
export type SidebarMenuName = "campaigns" | "tester" | "reviewer"

/** The routes under which a page belongs to each menu. */
const MENU_ROUTES = {
  campaigns: "/_authenticated/o/$organizationId/p/$projectId/a/$agentId/review-campaigns",
  tester: "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/test",
  reviewer:
    "/_authenticated/o/$organizationId/p/$projectId/review-campaigns/$reviewCampaignId/review",
} as const satisfies Record<SidebarMenuName, string>

const MENUS = ["campaigns", "tester", "reviewer"] as const satisfies SidebarMenuName[]

/**
 * The menu of the sidebar that holds the current page, which alone opens at first: the others
 * fold, so the page's menu stands out. On a page no menu holds, such as an agent's hub, none.
 */
export function useOpenSidebarMenu(): SidebarMenuName | null {
  return useMatches({
    select: (matches) =>
      MENUS.find((menu) => matches.some((match) => match.routeId.startsWith(MENU_ROUTES[menu]))) ??
      null,
  })
}

/** Whether a menu opens at first: the one of the current page, or every one when none holds it. */
export const isMenuOpenAtFirst = (menu: SidebarMenuName, openMenu: SidebarMenuName | null) =>
  openMenu === null || openMenu === menu
