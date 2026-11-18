import { ChevronDownIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SidebarMenuButton, SidebarMenuItem, SidebarMenuSub } from "@/components/ui/sidebar"

export type SidebarCollapsibleMenuProps = {
  label: ReactNode
  Icon: LucideIcon
  children: ReactNode
}

/**
 * An entry of the sidebar that opens a list under it, with a line on its left: the entries of a
 * section of the app. It starts open.
 */
export function SidebarCollapsibleMenu({ label, Icon, children }: SidebarCollapsibleMenuProps) {
  return (
    <Collapsible defaultOpen render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton className="group/collapsible" />}>
        <Icon aria-hidden />
        <span>{label}</span>
        <ChevronDownIcon
          aria-hidden
          className="ml-auto transition-transform group-not-aria-expanded/collapsible:-rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>{children}</SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
