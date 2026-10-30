import { CurrentUserMenu } from "@/features/account"
import { InvitationsButton } from "@/features/invitations"

/** The bottom of the sidebar on every signed-in page: the person's menu and their invitations. */
export function DeskSidebarFooter() {
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <CurrentUserMenu />
      </div>
      <InvitationsButton />
    </div>
  )
}
