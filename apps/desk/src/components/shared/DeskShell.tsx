import { useLingui } from "@lingui/react/macro"
import type { ReactNode } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
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
      <Sidebar>
        <SidebarHeader>{header}</SidebarHeader>
        <SidebarContent>{sidebar}</SidebarContent>
        <SidebarFooter>{footer}</SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-svh">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 bg-background px-3">
          <SidebarTrigger className="md:hidden" aria-label={t`Open the sidebar`} />
          <div className="min-w-0 truncate text-sm font-medium">{title}</div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
