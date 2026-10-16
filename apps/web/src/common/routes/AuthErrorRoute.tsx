import { Button } from "@caseai-connect/ui/shad/button"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router-dom"
import { type AuthCallbackError, isLostSigninState } from "@/common/auth/auth-callback-error"
import { signInErrorKey } from "@/common/auth/sign-in-error-key"
import { getAppUrl } from "@/config/runtime-config"
import { logout, takeTabReturnTo } from "@/external/oidcClient"

const LOST_STATE_RETRY_KEY = "oidc-lost-state-retry-at"
const LOST_STATE_RETRY_WINDOW_MS = 60_000

/**
 * A full reload drops the error parameters and the error the OIDC client
 * keeps in memory. The page this tab was on then starts a clean login, or the
 * home route when the tab kept no page.
 */
function restartSignin(): void {
  window.location.assign(`${getAppUrl()}${takeTabReturnTo() ?? ""}`)
}

/** True once per minute at most, so that a state that keeps getting lost cannot loop. */
function claimLostStateRetry(): boolean {
  try {
    const lastRetryAt = Number(window.sessionStorage.getItem(LOST_STATE_RETRY_KEY))
    if (Date.now() - lastRetryAt < LOST_STATE_RETRY_WINDOW_MS) return false
    window.sessionStorage.setItem(LOST_STATE_RETRY_KEY, String(Date.now()))
    return true
  } catch {
    return false
  }
}

/**
 * Shown when the identity provider comes back with an error instead of a
 * session, or when the API refuses a first sign-in. Explains the error and lets
 * the user retry or log out, instead of bouncing to the provider again in a loop.
 * The refusals the API explains get their own message and what to do next.
 * A lost sign-in state is not a refusal: the route signs in again once on its
 * own, and shows the error only when that new sign-in fails the same way.
 */
export function AuthErrorRoute({ error }: { error: AuthCallbackError }) {
  const { t } = useTranslation("auth", { keyPrefix: "callbackError" })
  const location = useLocation()
  const lostState = isLostSigninState(error)
  const refusal = signInErrorKey(error.description)
  const messageKey = lostState ? "lostState" : refusal ? `signInRefused.${refusal}` : null

  useEffect(() => {
    if (lostState && claimLostStateRetry()) restartSignin()
  }, [lostState])

  const logOut = () => {
    logout()
  }

  console.error("OIDC callback error:", error.code, error.description, location.pathname)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-4xl font-bold">{messageKey ? t(`${messageKey}.title`) : t("title")}</p>
      <p className="text-xl max-w-prose">
        {messageKey ? t(`${messageKey}.message`) : (error.description ?? error.code)}
      </p>
      <p className="text-muted-foreground max-w-prose">
        {messageKey ? t(`${messageKey}.hint`) : t("hint")}
      </p>
      <div className="flex gap-2">
        <Button onClick={restartSignin}>
          <span className="capitalize-first">{t("retry")}</span>
        </Button>
        <Button variant="outline" onClick={logOut}>
          <span className="capitalize-first">{t("logout")}</span>
        </Button>
      </div>
    </div>
  )
}
