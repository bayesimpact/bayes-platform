import { useAuth0 } from "@auth0/auth0-react"
import { useEffect } from "react"
import { useAuthCallbackError } from "@/common/auth/use-auth-callback-error"
import { selectTermsAccepted } from "@/common/features/me/me.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { AUTH0_ORGANIZATION_ID } from "@/config/auth0.config"
import { AuthErrorRoute } from "./AuthErrorRoute"
import { LoadingRoute } from "./LoadingRoute"
import { TermsRoute } from "./TermsRoute"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const isPlatformLoading = useAppSelector((state) => state.auth.isLoading)
  const termsAccepted = useAppSelector(selectTermsAccepted)
  // Auth0 sent us back with an error: show it instead of redirecting again.
  const callbackError = useAuthCallbackError()

  useEffect(() => {
    if (callbackError) return
    if (!isLoading && !isAuthenticated) {
      // Redirect to Auth0 login if not authenticated
      loginWithRedirect({
        authorizationParams: {
          organization: AUTH0_ORGANIZATION_ID,
        },
      })
    }
  }, [callbackError, isLoading, isAuthenticated, loginWithRedirect])

  if (callbackError) return <AuthErrorRoute error={callbackError} />
  if (isLoading || isPlatformLoading || !isAuthenticated) return <LoadingRoute />

  if (!termsAccepted) return <TermsRoute />

  return <>{children}</>
}
