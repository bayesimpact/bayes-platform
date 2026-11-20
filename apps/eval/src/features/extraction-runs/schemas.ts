import { extractionRunKeyMappingEntryInputSchema } from "@caseai-connect/eval-contracts"
import { z } from "zod"
import { recordsSearchSchema } from "@/lib/records-search"
import { isRunScopeValid, runScopeShape } from "@/lib/run-scope"
import { isKeyMappingComplete } from "./key-mapping"
import { EXTRACTION_RESULT_FILTERS } from "./result-filters"

/**
 * The form that starts an evaluation of an extraction agent: the version to evaluate, how its
 * fields read, and how many records to ask.
 */
export const extractionRunFormSchema = z
  .object({
    versionId: z.uuid(),
    keyMapping: z.array(extractionRunKeyMappingEntryInputSchema).refine(isKeyMappingComplete),
    ...runScopeShape,
  })
  .refine(isRunScopeValid, { path: ["limitedCount"] })

/**
 * The search params of a run's page: which of its results show, as the API pages them, and the
 * filter that narrows them to one status.
 */
export const extractionRunSearchSchema = recordsSearchSchema.extend({
  result: z.enum(EXTRACTION_RESULT_FILTERS).optional().catch(undefined),
})

export type ExtractionRunSearch = z.output<typeof extractionRunSearchSchema>
