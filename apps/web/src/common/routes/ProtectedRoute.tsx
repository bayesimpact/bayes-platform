import { useAuth0 } from "@auth0/auth0-react"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { selectTermsAccepted } from "@/common/features/me/me.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AUTH0_ORGANIZATION_ID } from "@/config/auth0.config"
import { buildReturnTo } from "./auth0-return-to"
import { LoadingRoute } from "./LoadingRoute"
import { TermsRoute } from "./TermsRoute"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const isPlatformLoading = useAppSelector((state) => state.auth.isLoading)
  const termsAccepted = useAppSelector(selectTermsAccepted)
  const location = useLocation()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to Auth0 login if not authenticated. Auth0 always sends the
      // user back to the origin, so remember the current location (path and
      // query) in appState; main.tsx navigates back to it after login.
      loginWithRedirect({
        appState: { returnTo: buildReturnTo(location) },
        authorizationParams: {
          organization: AUTH0_ORGANIZATION_ID,
        },
      })
    }
  }, [isLoading, isAuthenticated, loginWithRedirect, location])

  if (isLoading || isPlatformLoading || !isAuthenticated) return <LoadingRoute />

  if (!termsAccepted) return <TermsRoute />

  return <>{children}</>
}
