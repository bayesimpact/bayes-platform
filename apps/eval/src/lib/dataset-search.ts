import { z } from "zod"
import { recordsSearchSchema } from "./records-search"

/**
 * The search params of a dataset's page, for an agent of any type: its tab, the side panel that
 * starts an evaluation, and which of its
 * records show when the API pages them, as it does for an extraction dataset.
 */
export const datasetSearchSchema = recordsSearchSchema.extend({
  /** The tab shown: the records unless it says the runs. */
  tab: z.literal("runs").optional().catch(undefined),
  /** Whether the side panel that starts an evaluation on the dataset shows. */
  run: z.literal(true).optional().catch(undefined),
})

/** The search params of the datasets' list: `create` opens the dialog that names a new dataset. */
export const datasetsSearchSchema = z.object({
  create: z.literal(true).optional().catch(undefined),
})
