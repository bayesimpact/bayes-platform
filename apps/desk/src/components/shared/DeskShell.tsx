import { useLingui } from "@lingui/react/macro"
import { useRouter } from "@tanstack/react-router"
import { type ReactNode, useEffect, useState } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar"
import { useResizableWidth } from "@/hooks/use-resizable-width"
import { HeaderActionsContext } from "./header-actions-context"
import { ResizeHandle } from "./ResizeHandle"
import { SidebarToggle } from "./SidebarToggle"

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
  // The slot of the page's actions, known once the bar is mounted.
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  const sidebarWidth = useResizableWidth({
    storageKey: "desk.sidebarWidth",
    defaultWidth: 256,
    minWidth: 208,
    maxWidth: 420,
    edge: "right",
  })
  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth.width}px` }}
      // The sidebar eases its width when it opens or closes, but follows a drag at once.
      className={sidebarWidth.isResizing ? "**:transition-none" : undefined}
    >
      <CloseSidebarOnNavigation />
      <Sidebar>
        <SidebarHeader>{header}</SidebarHeader>
        <SidebarContent>{sidebar}</SidebarContent>
        <SidebarFooter>{footer}</SidebarFooter>
        <ResizeHandle
          edge="right"
          aria-label={t`Resize the sidebar`}
          className="hidden md:flex"
          {...sidebarWidth.handleProps}
        />
      </Sidebar>
      <SidebarInset className="h-svh min-h-0 min-w-0">
        {/* The bar fades into the page below it, as in the Claude app, over what scrolls under it. */}
        <header className="relative z-10 flex h-12 shrink-0 items-center gap-2 bg-background px-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:from-background after:to-transparent">
          {/* Shows or hides the sidebar, as ⌘B or Ctrl+B does. */}
          <SidebarToggle />
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>
          <div ref={setActionsSlot} className="flex shrink-0 items-center gap-2" />
        </header>
        {/* The page scrolls inside this frame, so a conversation can keep its message box in view. */}
        <HeaderActionsContext value={actionsSlot}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </HeaderActionsContext>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * At phone width, the sidebar opens over the page: a link chosen in it closes it, as the page it
 * opens should show. The router tells when a navigation to another page ends, which an effect
 * subscribes to.
 */
function CloseSidebarOnNavigation() {
  const router = useRouter()
  const { setOpenMobile } = useSidebar()
  useEffect(
    () =>
      router.subscribe("onResolved", (event) => {
        if (event.pathChanged) setOpenMobile(false)
      }),
    [router, setOpenMobile],
  )
  return null
}
