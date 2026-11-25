import { createOidcClient, createSignInGuards, type OidcConfig } from "@caseai-connect/sign-in"
import { appBasePath, appConfig, isMockMode } from "@/app/config"
import { adoptDeskSession } from "./adopt-desk-session"

/**
 * The Desk's session: the OIDC client of @caseai-connect/sign-in, on the session every app of
 * the origin shares, or in mock mode a signed-in stand-in, since the mock mode has no identity
 * provider. Everything outside lib/auth goes through this file.
 */

export {
  AuthenticationRequiredError,
  readLoginHint,
  type SignInCallbackSearch,
  SignInLoopError,
  type SignInProblem,
  SignInRefusedError,
  signInCallbackProblemOf,
  signInCallbackSearchSchema,
  signInRefusalOf,
} from "@caseai-connect/sign-in"

function getOidcConfig(): OidcConfig {
  if (appConfig.mode !== "api") throw new Error("The mock mode has no sign-in")
  return appConfig
}

const oidcClient = createOidcClient({
  basePath: appBasePath,
  storageNamespace: "desk",
  getConfig: getOidcConfig,
  prepareStorage: adoptDeskSession,
})

export const { claimAutomaticSignIn, claimLostStateRetry, releaseAutomaticSignIn } =
  createSignInGuards("desk")

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
