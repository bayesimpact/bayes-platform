import type {
  ExtractionDatasetColumnDto,
  ExtractionDatasetColumnRoleDto,
  ExtractionDatasetOutputDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** The roles a column can take, in the order the app offers them. */
export const COLUMN_ROLES = [
  "target",
  "input",
  "reference",
  "ignore",
] as const satisfies ExtractionDatasetColumnRoleDto[]

/** The name of each role of a column. */
export const COLUMN_ROLE_LABELS = {
  input: msg({ message: "Input", comment: "The role of a dataset's column the agent reads" }),
  target: msg({
    message: "Target",
    comment: "The role of a dataset's column that holds a value the agent must find",
  }),
  reference: msg({
    message: "Reference",
    comment: "The role of a dataset's column shown beside the results, and not compared",
  }),
  ignore: msg({ message: "Ignore", comment: "The role of a dataset's column that is left out" }),
} satisfies Record<ExtractionDatasetColumnRoleDto, MessageDescriptor>

/** What each role of a column means to an evaluation, in a few words. */
export const COLUMN_ROLE_DESCRIPTIONS = {
  input: msg({
    message: "What the agent reads",
    comment: "What the Input role of a dataset's column means",
  }),
  target: msg({
    message: "A value the agent must find",
    comment: "What the Target role of a dataset's column means",
  }),
  reference: msg({
    message: "Shown beside the results, and not compared",
    comment: "What the Reference role of a dataset's column means",
  }),
  ignore: msg({
    message: "Left out of the dataset",
    comment: "What the Ignore role of a dataset's column means",
  }),
} satisfies Record<ExtractionDatasetColumnRoleDto, MessageDescriptor>

/** The columns of a dataset, in the order of its file. */
export const columnsOf = (
  dataset: Pick<ExtractionDatasetOutputDto, "schemaMapping">,
): ExtractionDatasetColumnDto[] =>
  Object.values(dataset.schemaMapping).sort((first, second) => first.index - second.index)

/** The columns of a dataset that take one role, in the order of its file. */
export const columnsOfRole = (
  dataset: Pick<ExtractionDatasetOutputDto, "schemaMapping">,
  role: ExtractionDatasetColumnRoleDto,
) => columnsOf(dataset).filter((column) => column.role === role)

/** Whether a dataset got its records from a file: until then it has no column. */
export const isSetUp = (dataset: Pick<ExtractionDatasetOutputDto, "schemaMapping">) =>
  Object.keys(dataset.schemaMapping).length > 0

/** A value of a row, or of what an agent extracted, as text: nothing for a missing one. */
export function cellTextOf(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value)
}
