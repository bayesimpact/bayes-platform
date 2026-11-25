import { z } from "zod"

/** The signed-in person, as `GET desk/me` returns them. The Desk reads only these fields. */
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

/** The longest name a person can give themselves. */
export const USER_NAME_MAX_LENGTH = 100

/** The person's new name, as the API takes it: from 1 to 100 characters, without the spaces around. */
export const updateMeInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(USER_NAME_MAX_LENGTH),
})

export type UpdateMeInputDto = z.input<typeof updateMeInputSchema>

export const updateMeOutputSchema = z.object({ success: z.boolean() })

/** The person accepts the general conditions and the privacy policy, and chooses for AI usage. */
export const acceptTermsInputSchema = z.strictObject({
  aiUsagePolicyAccepted: z.boolean(),
})

export type AcceptTermsInputDto = z.input<typeof acceptTermsInputSchema>

export const acceptTermsOutputSchema = z.object({ success: z.boolean() })
