import { createFileRoute, Outlet } from "@tanstack/react-router"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { loadMe } from "@/features/account"
import { EvaluationAccessGate, loadEvaluationProjects } from "@/features/projects"
import {
  claimAutomaticSignIn,
  hasSession,
  readLoginHint,
  SignInLoopError,
  signIn,
} from "@/lib/auth/session"

/**
 * Every page of the app but the sign-in callback: a session, the signed-in person (`GET me`), at
 * least one project they can evaluate, then the page. A sign-in the API refuses shows here, and so
 * does a person without the evaluator role, before any page.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (await hasSession()) return
    // A session the browser did not keep after a sign-in a moment ago would send the person back
    // to the provider in a loop: the app stops and explains, as the API client does.
    if (!claimAutomaticSignIn()) throw new SignInLoopError()
    await signIn({ returnTo: location.publicHref, loginHint: readLoginHint(location.searchStr) })
    // The provider's page replaces this one: wait for it rather than render the route.
    await new Promise<never>(() => {})
  },
  loader: async ({ context }) => {
    await Promise.all([loadMe(context.queryClient), loadEvaluationProjects(context.queryClient)])
  },
  errorComponent: RouteErrorState,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <EvaluationAccessGate>
      <Outlet />
    </EvaluationAccessGate>
  )
}
