import { SidebarGroup, SidebarMenu, SidebarMenuSkeleton } from "@/components/ui/sidebar"

const PLACEHOLDER_ENTRIES = ["first", "second", "third", "fourth", "fifth"]

/** The shape of the sidebar's entries while they load: the history, or the whole shell. */
export function SidebarEntriesSkeleton() {
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
