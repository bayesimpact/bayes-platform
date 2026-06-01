import { SidebarMenuButton, SidebarMenuItem } from "@caseai-connect/ui/shad/sidebar"
import { cn } from "@caseai-connect/ui/utils"
import { Link } from "react-router-dom"
import type { MenuItem } from "../types"

export function AppNavItem({
  item,
  itemOptions,
  children,
}: {
  item: MenuItem
  itemOptions?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={item.isActive} asChild>
        <Link to={item.url}>
          {item.icon && <item.icon />}
          <span className={cn(item.isActive && "font-semibold")}>{item.title}</span>

          {itemOptions}
        </Link>
      </SidebarMenuButton>

      {children}
    </SidebarMenuItem>
  )
}
