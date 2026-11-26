import { createOidcClient, createSignInGuards, type OidcConfig } from "@bayes-platform/sign-in"
import { appBasePath, appConfig, isMockMode } from "@/app/config"

/**
 * The app's session: the OIDC client of @bayes-platform/sign-in, on the session every app of
 * the origin shares, or in mock mode a signed-in stand-in, since the mock mode has no identity
 * provider. Everything outside lib/auth goes through this file.
 */

export {
  readLoginHint,
  type SignInCallbackSearch,
  SignInLoopError,
  type SignInProblem,
  SignInRefusedError,
  signInCallbackProblemOf,
  signInCallbackSearchSchema,
} from "@bayes-platform/sign-in"

function getOidcConfig(): OidcConfig {
  if (appConfig.mode !== "api") throw new Error("The mock mode has no sign-in")
  return appConfig
}

const oidcClient = createOidcClient({
  basePath: appBasePath,
  storageNamespace: "eval",
  getConfig: getOidcConfig,
})

export const { claimAutomaticSignIn, claimLostStateRetry, releaseAutomaticSignIn } =
  createSignInGuards("eval")

export const { onSessionEnded, takeTabReturnTo } = oidcClient

export function hasSession(): Promise<boolean> {
  return isMockMode ? Promise.resolve(true) : oidcClient.hasSession()
}

export function getAccessToken(options?: { forceRefresh?: boolean }): Promise<string> {
  return isMockMode ? Promise.resolve("mock-access-token") : oidcClient.getAccessToken(options)
}

export function signIn(params: { returnTo: string; loginHint?: string }): Promise<void> {
  return isMockMode ? Promise.resolve() : oidcClient.signIn(params)
}

export function completeSignIn(): Promise<string> {
  return isMockMode ? Promise.resolve(appBasePath) : oidcClient.completeSignIn()
}

export function endSession(): Promise<void> {
  return isMockMode ? Promise.resolve() : oidcClient.endSession()
}

export async function signOut(): Promise<void> {
  // The person signs out on purpose: their next sign-in, even a moment later, is no loop.
  releaseAutomaticSignIn()
  if (!isMockMode) return oidcClient.signOut()
  window.location.assign(appBasePath)
}
