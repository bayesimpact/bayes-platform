import { CurrentUserMenu } from "@/features/account"

/** The bottom of the sidebar on every signed-in page: the person's menu, at the start of the row. */
export function AppSidebarFooter() {
  return (
    <div className="min-w-0">
      <CurrentUserMenu />
    </div>
  )
}
