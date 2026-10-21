import { msg } from "@lingui/core/macro"
import { z } from "zod"

/** The message of a required document left unchecked, translated where the form shows it. */
export const REQUIRED_TERMS_MESSAGE = msg`Accept the general conditions and the privacy policy to continue.`

/**
 * The terms form: the general conditions and the privacy policy must be accepted, the AI usage
 * policy is the person's choice. The API takes the last one only, so this schema is the app's.
 */
export const termsFormSchema = z.object({
  generalConditionsAccepted: z.boolean().refine((isAccepted) => isAccepted, {
    message: REQUIRED_TERMS_MESSAGE.id,
  }),
  privacyPolicyAccepted: z.boolean().refine((isAccepted) => isAccepted, {
    message: REQUIRED_TERMS_MESSAGE.id,
  }),
  aiUsagePolicyAccepted: z.boolean(),
})

export type TermsFormValues = z.output<typeof termsFormSchema>
