/**
 * The sign-in of the apps of the new frontend stack (ADR 0031, section 2.4): one OIDC client per
 * app, on the session every app of the origin shares. No app owns this package. It holds no React,
 * no component and no text the person reads: each app keeps its own pages around it. It exports
 * what the apps use, and nothing more.
 */

export { readLoginHint } from "./login-hint"
export { AuthenticationRequiredError, createOidcClient } from "./oidc-client"
export { appStorePrefix, type OidcConfig, sessionStorageKey } from "./oidc-settings"
export {
  createSignInGuards,
  type SignInCallbackSearch,
  SignInLoopError,
  type SignInProblem,
  SignInRefusedError,
  signInCallbackProblemOf,
  signInCallbackSearchSchema,
} from "./sign-in-problems"
export { signInRefusalOf } from "./sign-in-refusals"
