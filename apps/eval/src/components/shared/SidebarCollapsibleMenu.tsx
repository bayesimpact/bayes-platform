import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/app-ui/components/collapsible"
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@caseai-connect/app-ui/components/sidebar"
import { ChevronDownIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type SidebarCollapsibleMenuProps = {
  label: ReactNode
  Icon: LucideIcon
  /** Whether the menu starts open; it does unless told otherwise. */
  isOpenAtFirst?: boolean
  children: ReactNode
}

/**
 * An entry of the sidebar that opens a list under it, with a line on its left: the entries of a
 * section of the app. It starts open, unless `isOpenAtFirst` says otherwise.
 */
export function SidebarCollapsibleMenu({
  label,
  Icon,
  isOpenAtFirst = true,
  children,
}: SidebarCollapsibleMenuProps) {
  return (
    <Collapsible defaultOpen={isOpenAtFirst} render={<SidebarMenuItem />}>
      <CollapsibleTrigger render={<SidebarMenuButton className="group/collapsible" />}>
        <Icon aria-hidden />
        <span>{label}</span>
        <ChevronDownIcon
          aria-hidden
          className="ml-auto transition-transform group-not-aria-expanded/collapsible:-rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub className="mr-0 pr-0">{children}</SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
