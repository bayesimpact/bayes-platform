import { z } from "zod"

/** The search params of the comparison of runs: the ids of the runs, joined by commas. */
export const compareRunsSearchSchema = z.object({
  runs: z.string().optional().catch(undefined),
})

const runIdSchema = z.uuid()

/** The ids of the runs to compare, from the search param: what is not an id is left out. */
export const runIdsOf = (runs: string | undefined): string[] =>
  (runs ?? "").split(",").filter((runId) => runIdSchema.safeParse(runId).success)
