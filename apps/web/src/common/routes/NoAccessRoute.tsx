import { Button } from "@caseai-connect/ui/shad/button"
import { useTranslation } from "react-i18next"
import { logout } from "@/external/oidcClient"

/**
 * Shown to a signed-in user who has no workspace yet. Access is given by an
 * administrator who adds the person by email; nothing to accept here.
 */
export function NoAccessRoute() {
  const { t } = useTranslation("auth", { keyPrefix: "noAccess" })
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-4xl font-bold">{t("title")}</p>
      <p className="text-muted-foreground max-w-prose">{t("description")}</p>
      <Button variant="outline" onClick={() => logout()}>
        <span className="capitalize-first">{t("logout")}</span>
      </Button>
    </div>
  )
}
