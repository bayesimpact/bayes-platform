import { z } from "zod"

/** The search params of a run's page: the page of its records, the first one by default. */
export const conversationRunSearchSchema = z.object({
  page: z.number().int().min(0).optional().catch(undefined),
})
