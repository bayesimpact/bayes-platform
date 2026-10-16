import { useEffect, useRef } from "react"
import { useAuth } from "react-oidc-context"
import { useNavigate } from "react-router-dom"
import { readLoginHint } from "@/common/auth/login-hint"
import { useAuthCallbackError } from "@/common/auth/use-auth-callback-error"
import { login, takeSigninReturnTo } from "@/external/oidcClient"
import { AuthErrorRoute } from "./AuthErrorRoute"
import { RouteNames } from "./helpers"
import { LoadingRoute } from "./LoadingRoute"

export function HomeRoute() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated } = useAuth()
  const callbackError = useAuthCallbackError()
  // The return path is read once. StrictMode runs effects twice in development:
  // without this guard, the second run would find it gone and go to the onboarding.
  const hasNavigated = useRef(false)

  useEffect(() => {
    if (isLoading || callbackError) return

    if (isAuthenticated) {
      if (hasNavigated.current) return
      hasNavigated.current = true
      // Back to the page that started the sign-in, else the onboarding
      navigate(takeSigninReturnTo() ?? RouteNames.ONBOARDING)
    } else {
      login({ loginHint: readLoginHint() })
    }
  }, [callbackError, isAuthenticated, isLoading, navigate])

  if (callbackError) return <AuthErrorRoute error={callbackError} />
  return <LoadingRoute />
}
