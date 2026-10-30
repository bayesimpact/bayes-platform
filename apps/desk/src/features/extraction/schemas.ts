import { z } from "zod"

/**
 * The page of a CSV run's rows, and their order, as the URL keeps them. `sortBy` stays a string:
 * it names a column of the file (`input_…`) or of the agent's answers (`agent_…`), which each run
 * defines. A value the URL holds that does not fit falls back to the default.
 */
export const csvRecordsSearchSchema = z.object({
  page: z.number().int().min(0).default(0).catch(0),
  sortBy: z.string().optional().catch(undefined),
  sortOrder: z.enum(["asc", "desc"]).optional().catch(undefined),
})

export type CsvRecordsPage = z.output<typeof csvRecordsSearchSchema>
