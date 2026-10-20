import { appBasePath, isMockMode } from "@/app/config"
import * as oidcClient from "./oidc-client"

/**
 * The Desk's session: the OIDC client's, or in mock mode a signed-in stand-in, since the mock mode
 * has no identity provider. Everything outside lib/auth goes through this file.
 */

export { readLoginHint } from "./login-hint"
export { AuthenticationRequiredError, onSessionEnded, takeTabReturnTo } from "./oidc-client"

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
  if (!isMockMode) return oidcClient.signOut()
  window.location.assign(appBasePath)
}
