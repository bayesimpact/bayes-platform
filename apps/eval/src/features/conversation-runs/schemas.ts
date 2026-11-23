import { conversationRunInputSchema } from "@caseai-connect/eval-contracts"
import { z } from "zod"
import { isRunScopeValid, runScopeShape } from "@/lib/run-scope"

/**
 * The form that starts an evaluation of a conversation agent: the version to evaluate, the judge,
 * with the rules of the route that creates the run, and how much of the dataset to ask.
 */
export const conversationRunFormSchema = z
  .object({
    versionId: z.uuid(),
    judgeModel: conversationRunInputSchema.shape.judgeModel,
    // The form holds a text, which the page sends as `null` when it is blank.
    judgeInstructions: conversationRunInputSchema.shape.judgeInstructions.unwrap(),
    ...runScopeShape,
  })
  .refine(isRunScopeValid, { path: ["limitedCount"] })
