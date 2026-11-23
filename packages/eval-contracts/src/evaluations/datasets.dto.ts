import { z } from "zod"

/** The shortest name of a dataset, for an agent of any type. */
export const DATASET_NAME_MIN_LENGTH = 3

/** The name of a new dataset, or the new name of one, for an agent of any type. */
export const datasetNameInputSchema = z.strictObject({
  name: z.string().trim().min(DATASET_NAME_MIN_LENGTH),
})

export type DatasetNameInputDto = z.input<typeof datasetNameInputSchema>
