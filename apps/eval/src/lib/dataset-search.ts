import { z } from "zod"

/** The search params of a dataset's page, for an agent of any type: its tab. */
export const datasetSearchSchema = z.object({
  /** The tab shown: the records unless it says the runs. */
  tab: z.literal("runs").optional().catch(undefined),
})

/** The search params of the datasets' list: `create` opens the dialog that names a new dataset. */
export const datasetsSearchSchema = z.object({
  create: z.literal(true).optional().catch(undefined),
})
