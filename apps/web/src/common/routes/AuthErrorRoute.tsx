import { Button } from "@caseai-connect/ui/shad/button"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import type { AuthCallbackError } from "@/common/auth/auth-callback-error"
import { getAppUrl } from "@/config/runtime-config"
import { logout } from "@/external/oidcClient"

/**
 * Shown when the identity provider comes back with an error instead of a
 * session. Explains the error and lets the user retry or log out, instead of
 * bouncing to the provider again in a loop.
 */
export function AuthErrorRoute({ error }: { error: AuthCallbackError }) {
  const { t } = useTranslation("auth", { keyPrefix: "callbackError" })
  const location = useLocation()

  const retry = () => {
    // A full reload drops the error parameters and the error the OIDC client
    // keeps in memory, then the home route starts a clean login.
    window.location.assign(getAppUrl())
  }

  const logOut = () => {
    logout()
  }

  console.error("OIDC callback error:", error.code, error.description, location.pathname)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-4xl font-bold">{t("title")}</p>
      <p className="text-xl">{error.description ?? error.code}</p>
      <p className="text-muted-foreground max-w-prose">{t("hint")}</p>
      <div className="flex gap-2">
        <Button onClick={retry}>
          <span className="capitalize-first">{t("retry")}</span>
        </Button>
        <Button variant="outline" onClick={logOut}>
          <span className="capitalize-first">{t("logout")}</span>
        </Button>
      </div>
    </div>
  )
}
