import type { ReactNode } from "react"

export type SidebarSubGroupLabelProps = {
  children: ReactNode
}

/** The name of a group of entries inside a menu of the sidebar, which separates it from the others. */
export function SidebarSubGroupLabel({ children }: SidebarSubGroupLabelProps) {
  return (
    <li className="px-2 pt-2 pb-0.5 text-xs font-medium text-muted-foreground first:pt-0.5">
      {children}
    </li>
  )
}
