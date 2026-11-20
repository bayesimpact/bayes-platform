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

/**
 * The search params of the comparison of runs: the ids of the runs, joined by commas, and the
 * page of their records, counted from 0.
 */
export const compareRunsSearchSchema = z.object({
  runs: z.string().optional().catch(undefined),
  page: z.number().int().min(0).optional().catch(undefined),
})

const runIdSchema = z.uuid()

/** The ids of the runs to compare, from the search param: what is not an id is left out. */
export const runIdsOf = (runs: string | undefined): string[] =>
  (runs ?? "").split(",").filter((runId) => runIdSchema.safeParse(runId).success)
