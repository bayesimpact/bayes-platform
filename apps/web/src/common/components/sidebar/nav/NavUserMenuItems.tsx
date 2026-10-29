import { DropdownMenuItem, DropdownMenuSeparator } from "@caseai-connect/ui/shad/dropdown-menu"
import { ExternalLinkIcon, LogOutIcon, PlugIcon, UserPenIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConnectedAppsDialog } from "@/common/features/oauth-grants/components/ConnectedAppsDialog"
import { useAuthHandler } from "@/common/hooks/use-auth-handler"
import { runtimeConfig } from "@/config/runtime-config"
import { EditProfileDialog } from "./EditProfileDialog"

/** Dialog a user menu entry opens. */
export type UserMenuDialog = "editProfile" | "connectedApps"

type Props = {
  onOpenDialog: (dialog: UserMenuDialog) => void
}

export function NavUserMenuItems({ onOpenDialog }: Props) {
  return (
    <>
      <EditProfileMenuItem onOpen={() => onOpenDialog("editProfile")} />

      <ConnectedAppsMenuItem onOpen={() => onOpenDialog("connectedApps")} />

      <HelpCenter />

      <DropdownMenuSeparator />

      <LogOutButton />
    </>
  )
}

function EditProfileMenuItem({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("user")
  return (
    <DropdownMenuItem onSelect={onOpen}>
      <UserPenIcon />
      {t("editProfile")}
    </DropdownMenuItem>
  )
}

function ConnectedAppsMenuItem({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation("user")
  return (
    <DropdownMenuItem onSelect={onOpen}>
      <PlugIcon />
      {t("connectedApps")}
    </DropdownMenuItem>
  )
}

/** Dialogs opened from the user menu, rendered next to it. */
export function UserMenuDialogs({
  openDialog,
  onClose,
}: {
  openDialog: UserMenuDialog | null
  onClose: () => void
}) {
  return (
    <>
      <EditProfileDialog open={openDialog === "editProfile"} onClose={onClose} />
      <ConnectedAppsDialog open={openDialog === "connectedApps"} onClose={onClose} />
    </>
  )
}

function HelpCenter() {
  const { t } = useTranslation("user")
  const path = runtimeConfig.helpCenterUrl
  if (!path) return null
  return (
    <DropdownMenuItem onSelect={() => window.open(path, "_blank")}>
      <ExternalLinkIcon />
      {t("helpCenter")}
    </DropdownMenuItem>
  )
}

function LogOutButton() {
  const { t } = useTranslation("user")
  const { handleLogOut } = useAuthHandler()
  return (
    <DropdownMenuItem onSelect={handleLogOut}>
      <LogOutIcon />
      {t("logout")}
    </DropdownMenuItem>
  )
}
