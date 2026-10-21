import { useLingui } from "@lingui/react/macro"
import { useRouterState } from "@tanstack/react-router"
import { type ReactNode, useEffect } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

export type DeskShellProps = {
  /** The top of the sidebar: the logo, or the agent switcher. */
  header: ReactNode
  /** The sidebar's body: the new-session link and the history. */
  sidebar?: ReactNode
  /** The bottom of the sidebar, such as the user menu. */
  footer: ReactNode
  /** What the bar above the page names, such as the current agent. */
  title?: ReactNode
  children: ReactNode
}

/**
 * The Desk's frame, as in the Claude app: a sidebar on the left, the page in the center. At phone
 * width, the sidebar opens over the page from a button in the bar.
 */
export function DeskShell({ header, sidebar, footer, title, children }: DeskShellProps) {
  const { t } = useLingui()
  return (
    <SidebarProvider>
      <CloseSidebarOnNavigation />
      <Sidebar>
        <SidebarHeader>{header}</SidebarHeader>
        <SidebarContent>{sidebar}</SidebarContent>
        <SidebarFooter>{footer}</SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-svh min-h-0">
        <header className="flex h-12 shrink-0 items-center gap-2 bg-background px-3">
          <SidebarTrigger className="md:hidden" aria-label={t`Open the sidebar`} />
          <div className="min-w-0 truncate text-sm font-medium">{title}</div>
        </header>
        {/* The page scrolls inside this frame, so a conversation can keep its message box in view. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * At phone width, the sidebar opens over the page: a link chosen in it closes it, as the page it
 * opens should show. Navigation is outside React's state, which an effect follows.
 */
function CloseSidebarOnNavigation() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { setOpenMobile } = useSidebar()
  // biome-ignore lint/correctness/useExhaustiveDependencies: the path is what triggers it.
  useEffect(() => {
    setOpenMobile(false)
  }, [pathname, setOpenMobile])
  return null
}
