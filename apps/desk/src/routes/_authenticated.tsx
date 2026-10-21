import { createFileRoute, Outlet } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { meQueryOptions } from "@/features/account"
import { hasSession, readLoginHint, signIn } from "@/lib/auth/session"

/** Every page of the Desk but the sign-in callback: a session, then the page in its frame. */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (await hasSession()) return
    await signIn({ returnTo: location.publicHref, loginHint: readLoginHint(location.searchStr) })
    // The provider's page replaces this one: wait for it rather than render the route.
    await new Promise<never>(() => {})
  },
  // The user menu must not block the page: its query starts here, unawaited, and the menu waits
  // for it in a Suspense of its own while the page shows its skeleton.
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(meQueryOptions())
  },
  errorComponent: RouteErrorState,
  component: Outlet,
})
