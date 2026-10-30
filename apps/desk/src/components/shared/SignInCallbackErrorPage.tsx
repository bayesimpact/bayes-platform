import { useEffect } from "react"
import { appBasePath } from "@/app/config"
import {
  claimLostStateRetry,
  type SignInCallbackSearch,
  signIn,
  signInCallbackProblemOf,
  takeTabReturnTo,
} from "@/lib/auth/session"
import { SignInProblemPage } from "./SignInProblemPage"

export type SignInCallbackErrorPageProps = {
  /** Why completing the sign-in failed. */
  error: unknown
  /** The provider's return, which says why it refused. */
  search: SignInCallbackSearch
}

/**
 * The provider came back with an error, or this tab lost its sign-in: the page explains, rather
 * than send the person back to the provider, which would answer the same. A lost state is not a
 * refusal: the page tries once on its own, once a minute at most, and explains if that fails too.
 */
export function SignInCallbackErrorPage({ error, search }: SignInCallbackErrorPageProps) {
  const callbackProblem = signInCallbackProblemOf(error, search)
  const isLostState = callbackProblem.problem === "lostState"
  const startAgain = () => void signIn({ returnTo: takeTabReturnTo() ?? appBasePath })

  // Leaving for the provider is outside React, which an effect starts once, on arrival.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the lost state is read once, on arrival.
  useEffect(() => {
    if (isLostState && claimLostStateRetry()) startAgain()
  }, [])

  return <SignInProblemPage {...callbackProblem} onRetry={startAgain} />
}
