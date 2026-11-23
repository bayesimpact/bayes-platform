import { z } from "zod"
import { type RecordsSearch, recordsSearchSchema } from "./records-search"
import { RUN_STATUS_ORDER } from "./run-status"

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
  /** The status whose runs show, in the runs tab: the first one that holds runs without it. */
  status: z.enum(RUN_STATUS_ORDER).optional().catch(undefined),
})

/** Which records of a dataset show, of the search params of its page. */
export const recordsSearchOfDataset = ({
  page,
  sortBy,
  sortOrder,
  filters,
}: z.output<typeof datasetSearchSchema>): RecordsSearch => ({ page, sortBy, sortOrder, filters })

/** The search params of the datasets' list: `create` opens the dialog that names a new dataset. */
export const datasetsSearchSchema = z.object({
  create: z.literal(true).optional().catch(undefined),
})
