import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@caseai-connect/app-ui/components/collapsible"
import {
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@caseai-connect/app-ui/components/sidebar"
import { ChevronDownIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type SidebarCollapsibleSubMenuProps = {
  label: ReactNode
  Icon: LucideIcon
  /** Whether the sub-menu starts open. */
  isOpenAtFirst: boolean
  children: ReactNode
}

/**
 * An entry inside a menu of the sidebar that opens a list of its own under it, one level further
 * in: a part of a section of the app, such as the campaigns the person reviews.
 */
export function SidebarCollapsibleSubMenu({
  label,
  Icon,
  isOpenAtFirst,
  children,
}: SidebarCollapsibleSubMenuProps) {
  return (
    <Collapsible defaultOpen={isOpenAtFirst} render={<SidebarMenuSubItem className="mt-2" />}>
      <CollapsibleTrigger
        render={
          <SidebarMenuSubButton
            render={<button type="button" />}
            className="group/collapsible w-full text-left"
          />
        }
      >
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
