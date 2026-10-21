import { createFileRoute, type ErrorComponentProps, redirect } from "@tanstack/react-router"
import { useEffect } from "react"
import { appBasePath } from "@/app/config"
import { type SignInProblem, SignInProblemPage } from "@/components/shared/SignInProblemPage"
import { claimLostStateRetry, completeSignIn, signIn, takeTabReturnTo } from "@/lib/auth/session"

/** Where the identity provider sends the person back: completes the sign-in, then opens their page. */
export const Route = createFileRoute("/auth/callback")({
  beforeLoad: async () => {
    const returnTo = await completeSignIn()
    throw redirect({ href: returnTo, replace: true })
  },
  errorComponent: SignInErrorPage,
})

/** The OIDC client's words when the state of this sign-in is gone from the storage. */
const LOST_STATE_MESSAGE = "No matching state found in storage"

/**
 * The provider came back with an error, or this tab lost its sign-in: the page explains, rather
 * than send the person back to the provider, which would answer the same. A lost state is not a
 * refusal: the page tries once on its own, once a minute at most, and explains if that fails too.
 */
function SignInErrorPage({ error }: ErrorComponentProps) {
  const params = new URLSearchParams(window.location.search)
  const providerError = params.get("error")
  const detail = params.get("error_description") ?? providerError
  const message = error instanceof Error ? error.message : String(error)
  const isLostState = message.includes(LOST_STATE_MESSAGE)
  const problem: SignInProblem = isLostState ? "lostState" : "providerRefused"
  const startAgain = () => void signIn({ returnTo: takeTabReturnTo() ?? appBasePath })

  // Leaving for the provider is outside React, which an effect starts once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the lost state is read once, on arrival.
  useEffect(() => {
    if (isLostState && claimLostStateRetry()) startAgain()
  }, [])

  return (
    <SignInProblemPage
      problem={problem}
      detail={isLostState ? null : (detail ?? message)}
      onRetry={startAgain}
    />
  )
}
