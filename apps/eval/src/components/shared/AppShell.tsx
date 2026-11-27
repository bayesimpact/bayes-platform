import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@caseai-connect/app-ui/components/sidebar"
import { HeaderActionsContext } from "@caseai-connect/app-ui/compositions/header-actions-context"
import { ResizeHandle } from "@caseai-connect/app-ui/compositions/ResizeHandle"
import { SidePanelStorageKeyContext } from "@caseai-connect/app-ui/compositions/side-panel-storage-key-context"
import { useMediaQuery, useResizableWidth } from "@caseai-connect/frontend-lib"
import { useLingui } from "@lingui/react/macro"
import { useRouter } from "@tanstack/react-router"
import { cn } from "cn"
import { type ReactNode, useEffect, useState } from "react"
import { useSidebarPeek } from "@/hooks/use-sidebar-peek"
import { HeaderActionsMenu } from "./HeaderActionsMenu"
import { HeaderBackContext } from "./header-back-context"
import { NewReleaseBanner } from "./NewReleaseBanner"
import { SidebarToggle } from "./SidebarToggle"

export type AppShellProps = {
  /** The top of the sidebar: the logo, or the agent switcher. */
  header: ReactNode
  /** The sidebar's body: its links. */
  sidebar?: ReactNode
  /** The bottom of the sidebar, such as the user menu. */
  footer: ReactNode
  /** What the bar above the page names, such as the current agent. */
  title?: ReactNode
  children: ReactNode
}

/**
 * The app's frame, as in the app: a sidebar on the left, the page in the center. Once hidden, the
 * sidebar peeks over the page while the pointer rests on its button. At phone width, the sidebar
 * opens over the page from a button in the bar.
 */
export function AppShell({ header, sidebar, footer, title, children }: AppShellProps) {
  const { t } = useLingui()
  // The slots of the page's back link and actions, known once the bar is mounted.
  const [backSlot, setBackSlot] = useState<HTMLElement | null>(null)
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  // Tailwind's `sm`: below it, the bar has no room for the page's actions, which go in a menu.
  const isPhone = useMediaQuery("(max-width: 39.99rem)")
  const sidebarPeek = useSidebarPeek()
  const sidebarWidth = useResizableWidth({
    storageKey: "eval.sidebarWidth",
    defaultWidth: 256,
    minWidth: 208,
    maxWidth: 420,
    edge: "right",
  })
  return (
    <SidePanelStorageKeyContext value="eval.sidePanelWidth">
      <SidebarProvider
        style={{ "--sidebar-width": `${sidebarWidth.width}px` }}
        // The sidebar eases its width when it opens or closes, but follows a drag at once.
        className={sidebarWidth.isResizing ? "**:transition-none" : undefined}
      >
        <CloseSidebarOnNavigation />
        <Sidebar
          // A hidden sidebar peeks over the page, which keeps its width: only the sidebar moves.
          data-peek={sidebarPeek.isPeeking || undefined}
          className={cn(
            "motion-reduce:transition-none",
            // Below the bar, as in Claude Desktop: the button that pins the sidebar stays in reach.
            "group-data-[collapsible=offcanvas]:data-peek:top-12 group-data-[collapsible=offcanvas]:data-peek:bottom-2 group-data-[collapsible=offcanvas]:data-peek:left-0! group-data-[collapsible=offcanvas]:data-peek:z-30 group-data-[collapsible=offcanvas]:data-peek:h-auto group-data-[collapsible=offcanvas]:data-peek:overflow-hidden group-data-[collapsible=offcanvas]:data-peek:rounded-r-lg group-data-[collapsible=offcanvas]:data-peek:border-y group-data-[collapsible=offcanvas]:data-peek:shadow-lg",
          )}
          {...sidebarPeek.peekHandlers}
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
          <header className="group/bar relative z-10 flex h-12 shrink-0 items-center gap-2 bg-background px-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-6 after:bg-linear-to-b after:from-background after:to-transparent">
            {/* Shows or hides the sidebar, as ⌘B or Ctrl+B does. */}
            <SidebarToggle
              peekHandlers={sidebarPeek.peekHandlers}
              onToggle={sidebarPeek.stopPeeking}
            />
            {/* At phone width, a page's way back takes the place of the title. */}
            <div className="min-w-0 shrink truncate text-sm font-medium empty:hidden max-sm:group-has-[[data-slot=header-back]:not(:empty)]/bar:hidden">
              {title}
            </div>
            <div
              ref={setBackSlot}
              data-slot="header-back"
              className="flex min-w-0 shrink items-center text-sm empty:hidden"
            />
            <div className="flex-1" />
            {isPhone ? (
              <HeaderActionsMenu slotRef={setActionsSlot} />
            ) : (
              <div ref={setActionsSlot} className="flex shrink-0 items-center gap-2" />
            )}
          </header>
          <NewReleaseBanner />
          {/* The page scrolls inside this frame, so a conversation can keep its message box in view. */}
          <HeaderBackContext value={backSlot}>
            <HeaderActionsContext value={actionsSlot}>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
            </HeaderActionsContext>
          </HeaderBackContext>
        </SidebarInset>
      </SidebarProvider>
    </SidePanelStorageKeyContext>
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
