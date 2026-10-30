import { z } from "zod"

/** A document the person must accept: the form refuses it unchecked. */
const requiredAcceptance = z.boolean().refine((isAccepted) => isAccepted)

/**
 * The terms form: the general conditions and the privacy policy must be accepted, the AI usage
 * policy is the person's choice. The API takes the last one only, so this schema is the app's.
 */
export const termsFormSchema = z.object({
  generalConditionsAccepted: requiredAcceptance,
  privacyPolicyAccepted: requiredAcceptance,
  aiUsagePolicyAccepted: z.boolean(),
})
