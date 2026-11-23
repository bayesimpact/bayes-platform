import { useLingui } from "@lingui/react/macro"
import { useRouter } from "@tanstack/react-router"
import { cn } from "cn"
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
import { useIsMobile } from "@/hooks/use-mobile"
import { useResizableWidth } from "@/hooks/use-resizable-width"
import { useSidebarPeek } from "@/hooks/use-sidebar-peek"
import { HeaderActionsContext } from "./header-actions-context"
import { NewReleaseBanner } from "./NewReleaseBanner"
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
 * width, the sidebar opens over the page from a button in the bar. Hidden at a desktop width, it
 * peeks over the page, below the bar, while the pointer is on that button.
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const isMobile = useIsMobile()
  const peek = useSidebarPeek({ canPeek: !isSidebarOpen && !isMobile })
  return (
    <SidebarProvider
      open={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
      style={{ "--sidebar-width": `${sidebarWidth.width}px` }}
      // The sidebar eases its width when it opens or closes, but follows a drag at once.
      className={sidebarWidth.isResizing ? "**:transition-none" : undefined}
    >
      <CloseSidebarOnNavigation />
      <Sidebar
        {...peek.sidebarProps}
        data-peek={peek.isPeeking ? "true" : undefined}
        className={cn(
          // A full-height sidebar when open; a card below the bar, over the page, when it peeks.
          // The corners and insets ease with it, unless the person asks for less motion.
          "h-auto transition-[left,right,width,translate,top,bottom,margin] *:data-[slot=sidebar-inner]:rounded-[inherit] motion-reduce:transition-none",
          "data-[peek=true]:top-12 data-[peek=true]:bottom-2 data-[peek=true]:z-20 data-[peek=true]:ml-2 data-[peek=true]:translate-x-(--sidebar-width) data-[peek=true]:rounded-lg data-[peek=true]:border data-[peek=true]:shadow-lg",
        )}
      >
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
          <SidebarToggle {...peek.toggleProps} />
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{title}</div>
          <div ref={setActionsSlot} className="flex shrink-0 items-center gap-2" />
        </header>
        <NewReleaseBanner />
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
  // The router is outside React: an effect subscribes to its navigations.
  useEffect(
    () =>
      router.subscribe("onResolved", (event) => {
        if (event.pathChanged) setOpenMobile(false)
      }),
    [router, setOpenMobile],
  )
  return null
}
