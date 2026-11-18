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
import { useMediaQuery } from "@/hooks/use-media-query"
import { useResizableWidth } from "@/hooks/use-resizable-width"
import { HeaderActionsMenu } from "./HeaderActionsMenu"
import { HeaderSlotsContext } from "./header-slots-context"
import { ResizeHandle } from "./ResizeHandle"
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
 * The app's frame, as in the app: a sidebar on the left, the page in the center. At phone
 * width, the sidebar opens over the page from a button in the bar.
 */
export function AppShell({ header, sidebar, footer, title, children }: AppShellProps) {
  const { t } = useLingui()
  // The slots of the page's back link and actions, known once the bar is mounted.
  const [backSlot, setBackSlot] = useState<HTMLElement | null>(null)
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  // Tailwind's `sm`: below it, the bar has no room for the page's actions, which go in a menu.
  const isPhone = useMediaQuery("(max-width: 39.99rem)")
  const sidebarWidth = useResizableWidth({
    storageKey: "eval.sidebarWidth",
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
          <div
            ref={setBackSlot}
            className="peer flex min-w-0 shrink items-center text-sm empty:hidden"
          />
          {/* At phone width, a page's way back takes the place of the title. */}
          <div className="min-w-0 flex-1 truncate text-sm font-medium max-sm:peer-not-empty:invisible">
            {title}
          </div>
          {isPhone ? (
            <HeaderActionsMenu slotRef={setActionsSlot} />
          ) : (
            <div ref={setActionsSlot} className="flex shrink-0 items-center gap-2" />
          )}
        </header>
        {/* The page scrolls inside this frame, so a conversation can keep its message box in view. */}
        <HeaderSlotsContext value={{ back: backSlot, actions: actionsSlot }}>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </HeaderSlotsContext>
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
