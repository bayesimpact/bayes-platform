import { screen, within } from "@testing-library/react"

/**
 * The entries of a menu of the sidebar, such as Campaigns or Tester, as their text reads: its
 * links and the names of its groups, in order, without what nests under them.
 */
export function sidebarMenuEntries(menuName: string): string[] {
  const menu = screen.getByRole("button", { name: menuName }).closest("li")
  const list = menu?.querySelector("ul")
  if (!list) throw new Error(`The sidebar has no menu named ${menuName}`)
  // The menu's own entries: a campaign's sessions or a sub-menu's campaigns nest under them.
  return [...list.children].map(
    (entry) => entry.firstElementChild?.textContent ?? entry.textContent ?? "",
  )
}

/** The link of a menu of the sidebar to the campaign of that name. */
export function sidebarMenuLink(menuName: string, campaignName: string): HTMLElement {
  const menu = screen.getByRole("button", { name: menuName }).closest("li")
  if (!menu) throw new Error(`The sidebar has no menu named ${menuName}`)
  return within(menu).getByRole("link", { name: campaignName })
}
