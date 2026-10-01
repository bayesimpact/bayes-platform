import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useAuthCallbackError } from "@/common/auth/use-auth-callback-error"
import { selectTermsAccepted } from "@/common/features/me/me.selectors"
import { useAppSelector } from "@/common/store/hooks"
import { login } from "@/external/oidcClient"
import { AuthErrorRoute } from "./AuthErrorRoute"
import { LoadingRoute } from "./LoadingRoute"
import { TermsRoute } from "./TermsRoute"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const isPlatformLoading = useAppSelector((state) => state.auth.isLoading)
  const termsAccepted = useAppSelector(selectTermsAccepted)
  const signInError = useAppSelector((state) => state.auth.signInError)
  const callbackError = useAuthCallbackError()

  useEffect(() => {
    if (callbackError) return
    if (!isLoading && !isAuthenticated) {
      // Redirect to the identity provider when not authenticated
      login()
    }
  }, [callbackError, isLoading, isAuthenticated])

  if (callbackError) return <AuthErrorRoute error={callbackError} />
  if (signInError) {
    return <AuthErrorRoute error={{ code: "sign_in_refused", description: signInError }} />
  }
  if (isLoading || isPlatformLoading || !isAuthenticated) return <LoadingRoute />

  if (!termsAccepted) return <TermsRoute />

  return <>{children}</>
}
