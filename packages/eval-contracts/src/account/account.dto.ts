import { z } from "zod"

/** The signed-in person, as `GET me` returns them. The app reads only these fields. */
export const meUserOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
})

export const meOutputSchema = z.object({
  user: meUserOutputSchema,
})

export type MeUserOutputDto = z.output<typeof meUserOutputSchema>
export type MeOutputDto = z.output<typeof meOutputSchema>

/**
 * Why the API refused a first sign-in: the `message` of its 401 on any route, `GET me` first. Signing in again
 * would fail the same way, so the app explains instead. The texts are the API's own
 * (packages/api-contracts/src/me/sign-in-errors.ts), which the app cannot import.
 */
export const SIGN_IN_REFUSALS = {
  "The identity provider did not return an email for this user": "emailRequired",
  "An account already exists for this email, but the identity provider does not report the email as verified":
    "emailNotVerified",
  "An account already exists for this email, and linking by email is disabled (OIDC_ALLOW_EMAIL_LINKING)":
    "emailLinkingDisabled",
} as const

export type SignInRefusal = (typeof SIGN_IN_REFUSALS)[keyof typeof SIGN_IN_REFUSALS]

/** The refusal an API message names, or `null` for any other message. */
export function signInRefusalOf(message: unknown): SignInRefusal | null {
  if (typeof message !== "string") return null
  // `in` would also match the keys every object inherits, such as `constructor`.
  return Object.hasOwn(SIGN_IN_REFUSALS, message)
    ? // Safe: `Object.hasOwn` just found the message among the object's own keys.
      SIGN_IN_REFUSALS[message as keyof typeof SIGN_IN_REFUSALS]
    : null
}
