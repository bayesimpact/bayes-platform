import { extractionRunKeyMappingEntryInputSchema } from "@bayes-platform/eval-contracts"
import { z } from "zod"
import { isRunScopeValid, runScopeShape } from "@/lib/run-scope"
import { isKeyMappingComplete } from "./key-mapping"

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
