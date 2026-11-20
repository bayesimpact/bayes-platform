import { z } from "zod"
import { recordsSearchSchema } from "@/lib/records-search"
import { EXTRACTION_RESULT_FILTERS } from "./result-filters"

/**
 * The search params of a run's page: which of its results show, as the API pages them, and the
 * filter that narrows them to one status.
 */
export const extractionRunSearchSchema = recordsSearchSchema.extend({
  result: z.enum(EXTRACTION_RESULT_FILTERS).optional().catch(undefined),
})

export type ExtractionRunSearch = z.output<typeof extractionRunSearchSchema>
