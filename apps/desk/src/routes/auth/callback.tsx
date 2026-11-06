import { createFileRoute, type ErrorComponentProps, redirect } from "@tanstack/react-router"
import { DeskShellSkeleton } from "@/components/shared/DeskShellSkeleton"
import { SignInCallbackErrorPage } from "@/components/shared/SignInCallbackErrorPage"
import { completeSignIn, signInCallbackSearchSchema } from "@/lib/auth/session"

/** Where the identity provider sends the person back: completes the sign-in, then opens their page. */
export const Route = createFileRoute("/auth/callback")({
  validateSearch: signInCallbackSearchSchema,
  beforeLoad: async () => {
    const returnTo = await completeSignIn()
    throw redirect({ href: returnTo, replace: true })
  },
  // The Desk's frame, which the page the sign-in opens fills.
  pendingComponent: DeskShellSkeleton,
  errorComponent: SignInCallbackError,
})

function SignInCallbackError({ error }: ErrorComponentProps) {
  return <SignInCallbackErrorPage error={error} search={Route.useSearch()} />
}
