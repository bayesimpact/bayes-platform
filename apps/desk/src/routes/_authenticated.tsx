import { ChatProvider } from "@caseai-connect/chat"
import { startQuery } from "@caseai-connect/frontend-lib"
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Suspense } from "react"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { RouteErrorState } from "@/components/shared/RouteErrorState"
import { meQueryOptions, TermsGate } from "@/features/account"
import { chat } from "@/features/conversation"
import {
  claimAutomaticSignIn,
  hasSession,
  readLoginHint,
  SignInLoopError,
  signIn,
} from "@/lib/auth/session"

/**
 * Every page of the Desk but the sign-in callback: a session, the terms accepted, then the page in
 * its frame. Every page gets the app's chat, which the hooks of `@caseai-connect/chat` read.
 */
export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (await hasSession()) return
    // A session the browser did not keep after a sign-in a moment ago would send the person back
    // to the provider in a loop: the Desk stops and explains, as the API client does.
    if (!claimAutomaticSignIn()) throw new SignInLoopError()
    await signIn({ returnTo: location.publicHref, loginHint: readLoginHint(location.searchStr) })
    // The provider's page replaces this one: wait for it rather than render the route.
    await new Promise<never>(() => {})
  },
  // The pages' loaders run beside this one: `me`, which the terms and the user menu read, starts
  // here unawaited, and the gate waits for it with the shape of the Desk.
  loader: ({ context }) => {
    startQuery(context.queryClient, meQueryOptions())
  },
  errorComponent: RouteErrorState,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <Suspense fallback={<DeskShellSkeleton />}>
      <TermsGate>
        <ChatProvider chat={chat}>
          <Outlet />
        </ChatProvider>
      </TermsGate>
    </Suspense>
  )
}
