import { SidebarGroup, SidebarMenu, SidebarMenuSkeleton } from "@/components/ui/sidebar"

const PLACEHOLDER_ENTRIES = ["first", "second", "third", "fourth", "fifth"]

/** The history's shape while it loads. */
export function AgentHistorySkeleton() {
  return (
    <SidebarGroup aria-busy="true">
      <SidebarMenu>
        {PLACEHOLDER_ENTRIES.map((entry) => (
          <SidebarMenuSkeleton key={entry} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
