import { z } from "zod"

/** The signed-in person, as `GET me` returns them. The Desk reads only these fields. */
export const meUserOutputSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  /** Whether the person accepted the current terms, which the Desk asks for before anything. */
  termsAccepted: z.boolean(),
})

/** A document of the terms the person accepts: where to read it, and its version. */
export const termsDocumentOutputSchema = z.object({
  url: z.string(),
  version: z.number(),
})

export const meOutputSchema = z.object({
  user: meUserOutputSchema,
  currentTerms: z.object({
    generalConditions: termsDocumentOutputSchema,
    privacyPolicy: termsDocumentOutputSchema,
    aiUsagePolicy: termsDocumentOutputSchema,
  }),
})

export type MeUserOutputDto = z.output<typeof meUserOutputSchema>
export type MeOutputDto = z.output<typeof meOutputSchema>
export type TermsDocumentOutputDto = z.output<typeof termsDocumentOutputSchema>

/** The person's new name, as the API takes it: from 1 to 100 characters, without the spaces around. */
export const updateMeInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
})

export type UpdateMeInputDto = z.input<typeof updateMeInputSchema>

export const updateMeOutputSchema = z.object({ success: z.boolean() })

/** The person accepts the general conditions and the privacy policy, and chooses for AI usage. */
export const acceptTermsInputSchema = z.strictObject({
  aiUsagePolicyAccepted: z.boolean(),
})

export const acceptTermsOutputSchema = z.object({ success: z.boolean() })

/**
 * Why the API refused a first sign-in: the `message` of its 401 on any route, `GET me` first.
 * Signing in again would fail the same way, so the Desk explains instead. The texts are the API's
 * own (packages/api-contracts/src/me/sign-in-errors.ts), which the Desk cannot import.
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
  return message in SIGN_IN_REFUSALS
    ? // Safe: `in` just found the message among the keys.
      SIGN_IN_REFUSALS[message as keyof typeof SIGN_IN_REFUSALS]
    : null
}
