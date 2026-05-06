import { useAuth0 } from "@auth0/auth0-react"
import { useEffect } from "react"
import { selectTermsAccepted } from "@/common/features/me/me.selectors"
import { useSetCurrentIds } from "@/common/hooks/use-set-current-ids"
import { useAppSelector } from "@/common/store/hooks"
import { AUTH0_ORGANIZATION_ID } from "@/config/auth0.config"
import { LoadingRoute } from "./LoadingRoute"
import { TermsRoute } from "./TermsRoute"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const isPlatformLoading = useAppSelector((state) => state.auth.isLoading)
  const termsAccepted = useAppSelector(selectTermsAccepted)

  useSetCurrentIds()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Redirect to Auth0 login if not authenticated
      loginWithRedirect({
        authorizationParams: {
          organization: AUTH0_ORGANIZATION_ID,
        },
      })
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  if (isLoading || isPlatformLoading || !isAuthenticated) return <LoadingRoute />

  if (!termsAccepted) return <TermsRoute />

  return <>{children}</>
}
