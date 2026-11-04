import { Button } from "@caseai-connect/ui/shad/button"
import { LogOutIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthHandler } from "@/common/hooks/use-auth-handler"

/** Log-out button for pages without the sidebar user menu. */
export function LogOutButton() {
  const { t } = useTranslation("user")
  const { handleLogOut } = useAuthHandler()
  return (
    <Button variant="ghost" onClick={handleLogOut}>
      <LogOutIcon />
      {t("logout")}
    </Button>
  )
}
