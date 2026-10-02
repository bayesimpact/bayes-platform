import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { useNavigate } from "react-router-dom"
import { readLoginHint } from "@/common/auth/login-hint"
import { useAuthCallbackError } from "@/common/auth/use-auth-callback-error"
import { login } from "@/external/oidcClient"
import { AuthErrorRoute } from "./AuthErrorRoute"
import { RouteNames } from "./helpers"
import { LoadingRoute } from "./LoadingRoute"

export function HomeRoute() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated } = useAuth()
  const callbackError = useAuthCallbackError()

  useEffect(() => {
    if (isLoading || callbackError) return

    if (isAuthenticated) {
      navigate(RouteNames.ONBOARDING)
    } else {
      login({ loginHint: readLoginHint() })
    }
  }, [callbackError, isAuthenticated, isLoading, navigate])

  if (callbackError) return <AuthErrorRoute error={callbackError} />
  return <LoadingRoute />
}
