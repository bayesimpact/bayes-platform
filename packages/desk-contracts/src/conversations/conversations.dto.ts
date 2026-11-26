import { z } from "zod"

/** A conversation the signed-in person just started, as `.../create` returns it. */
export const createdConversationOutputSchema = z.object({
  id: z.uuid(),
})

export type CreatedConversationOutputDto = z.output<typeof createdConversationOutputSchema>
