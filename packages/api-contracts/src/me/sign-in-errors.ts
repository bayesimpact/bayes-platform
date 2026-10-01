/**
 * Why the API refused a first sign-in (401 on any authenticated route, most
 * visibly `GET /me`). The web app shows these to the user instead of logging
 * out: signing in again would fail the same way.
 */
export const SIGN_IN_ERRORS = {
  EMAIL_REQUIRED: "The identity provider did not return an email for this user",
  EMAIL_NOT_VERIFIED:
    "An account already exists for this email, but the identity provider does not report the email as verified",
  EMAIL_LINKING_DISABLED:
    "An account already exists for this email, and linking by email is disabled (OIDC_ALLOW_EMAIL_LINKING)",
} as const

export type SignInError = (typeof SIGN_IN_ERRORS)[keyof typeof SIGN_IN_ERRORS]

export function isSignInError(message: unknown): message is SignInError {
  return Object.values(SIGN_IN_ERRORS).some((signInError) => signInError === message)
}
