import { z } from "zod"

/** How much of a dataset an evaluation asks: all its records, or the first ones only. */
export type RunScope = "all" | "limited"

/**
 * The part of a form that starts an evaluation which says how many records it asks. The count is
 * `NaN` while its field is empty, which `z.number()` refuses: `isRunScopeValid` decides, since the
 * count only matters for an evaluation of the first records.
 */
export const runScopeShape = {
  scope: z.enum(["all", "limited"]),
  limitedCount: z.union([z.number(), z.nan()]),
}

/**
 * Whether a form's scope can start an evaluation: the count only matters, and must be a whole
 * number of records, when the evaluation asks the first ones.
 */
export const isRunScopeValid = ({
  scope,
  limitedCount,
}: {
  scope: RunScope
  limitedCount: number
}) => scope === "all" || (Number.isInteger(limitedCount) && limitedCount >= 1)
