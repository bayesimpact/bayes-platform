import { z } from "zod"
import { recordsSearchSchema } from "./records-search"

/**
 * The search params of a run's page, for an agent of any type: which of its results show when the
 * API pages them, as it does for an extraction run, and the filter that narrows them, by its name.
 * Each type of agent has its own filters, and reads a name it does not know as none.
 */
export const runSearchSchema = recordsSearchSchema.extend({
  result: z.string().optional().catch(undefined),
})

export type RunSearch = z.output<typeof runSearchSchema>
