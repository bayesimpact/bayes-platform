import { useEffect } from "react"
import { useAuth } from "react-oidc-context"
import { authActions } from "@/common/features/auth/auth.slice"
import { useAppDispatch } from "@/common/store/hooks"

/**
 * Hook to sync the OIDC authentication state with Redux.
 * This allows the listenerMiddleware to react to authentication changes
 * and automatically fetch user data when the user becomes authenticated.
 */
export function useInitApi() {
  const { isAuthenticated, isLoading } = useAuth()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (isLoading) return
    dispatch(authActions.setAuthenticated(isAuthenticated))
  }, [isAuthenticated, isLoading, dispatch])
}
