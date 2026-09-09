import { useAuth0 } from "@auth0/auth0-react"
import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { getAuthCallbackError } from "@/common/auth/auth-callback-error"
import { selectOrganizationsData } from "@/common/features/organizations/organizations.selectors"
import { ADS } from "@/common/store/async-data-status"
import { useAppSelector } from "@/common/store/hooks"
import { AUTH0_ORGANIZATION_ID } from "@/config/auth0.config"
import { AuthErrorRoute } from "./AuthErrorRoute"
import { RouteNames } from "./helpers"
import { LoadingRoute } from "./LoadingRoute"

const INVITATION_STORAGE_KEY = "pendingInvitationTicketId"

/**
 * Stores the Auth0 invitation ticket_id in localStorage so it survives the OAuth redirect.
 */
export function storePendingInvitation(ticketId: string): void {
  localStorage.setItem(INVITATION_STORAGE_KEY, ticketId)
}

/**
 * Retrieves and clears the pending invitation ticket_id from localStorage.
 */
export function consumePendingInvitation(): string | null {
  const ticketId = localStorage.getItem(INVITATION_STORAGE_KEY)
  if (ticketId) {
    localStorage.removeItem(INVITATION_STORAGE_KEY)
  }
  return ticketId
}

export function HomeRoute() {
  const navigate = useNavigate()
  const { isLoading, isAuthenticated, loginWithRedirect, logout } = useAuth0()
  const organizations = useAppSelector(selectOrganizationsData)
  const [searchParams] = useSearchParams()
  // Auth0 sent us back with an error: show it instead of redirecting again.
  const callbackError = getAuthCallbackError(searchParams.toString())

  useEffect(() => {
    if (isLoading || callbackError) return

    // Check for Auth0 invitation params in the URL
    const invitation = searchParams.get("invitation")
    const organization = searchParams.get("organization")

    if (invitation && organization) {
      ;(async () => {
        // Clear the local SDK cache first
        await logout({ openUrl: false })

        // Store the ticket_id so we can accept the invitation after login
        storePendingInvitation(invitation)

        // Redirect to Auth0 with invitation params. Login forces the user to re-authenticate regardless of the existing session.
        loginWithRedirect({
          authorizationParams: {
            organization,
            invitation,
            prompt: "login",
          },
        })
      })()
      return
    }

    if (!ADS.isUninitialized(organizations) && !isAuthenticated) {
      loginWithRedirect({
        authorizationParams: {
          organization: AUTH0_ORGANIZATION_ID,
        },
      })
      return
    }

    if (isAuthenticated) {
      navigate(RouteNames.ONBOARDING)
    } else {
      loginWithRedirect({
        authorizationParams: {
          organization: AUTH0_ORGANIZATION_ID,
        },
      })
    }
  }, [
    callbackError,
    isAuthenticated,
    isLoading,
    loginWithRedirect,
    logout,
    organizations,
    searchParams,
    navigate,
  ])

  if (callbackError) return <AuthErrorRoute error={callbackError} />
  return <LoadingRoute />
}
