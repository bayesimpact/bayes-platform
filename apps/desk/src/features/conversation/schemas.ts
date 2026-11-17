import { messageFeedbackContentSchema } from "@caseai-connect/desk-contracts"
import { z } from "zod"

/**
 * The form that reports a problem with a reply: its text only, which a report needs. The dialog
 * sends it with the negative rating, as the route's body.
 */
export const reportFormSchema = z.strictObject({
  content: messageFeedbackContentSchema.min(1),
})
