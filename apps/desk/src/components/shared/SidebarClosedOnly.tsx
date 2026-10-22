import type { ReactNode } from "react"
import { useSidebar } from "@/components/ui/sidebar"

export type SidebarClosedOnlyProps = {
  children: ReactNode
}

/**
 * What shows only while the sidebar is closed: what the open sidebar already shows, such as the
 * agent's name, which the bar above the page then takes over. On a phone, the sidebar is a drawer
 * that stays closed until the person opens it.
 */
export function SidebarClosedOnly({ children }: SidebarClosedOnlyProps) {
  const { open, openMobile, isMobile } = useSidebar()
  const isOpen = isMobile ? openMobile : open
  return isOpen ? null : children
}
