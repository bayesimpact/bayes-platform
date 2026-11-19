import { z } from "zod"

/** The search params of a dataset's page: its tab, and the page of its records, the first one by default. */
export const conversationDatasetSearchSchema = z.object({
  page: z.number().int().min(0).optional().catch(undefined),
  /** The tab shown: the records unless it says the runs. */
  tab: z.literal("runs").optional().catch(undefined),
})

/** A tab of a dataset's page. */
export type ConversationDatasetTab = "records" | "runs"

/** The search params of the datasets' list: `create` opens the dialog that names a new dataset. */
export const conversationDatasetsSearchSchema = z.object({
  create: z.literal(true).optional().catch(undefined),
})
