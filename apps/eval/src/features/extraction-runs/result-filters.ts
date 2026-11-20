import type { ExtractionRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** What the table of a run's results can be narrowed to. */
export const EXTRACTION_RESULT_FILTERS = [
  "all",
  "mismatches",
  "errors",
  "matches",
  "waiting",
  "notAsked",
] as const

export type ExtractionResultFilter = (typeof EXTRACTION_RESULT_FILTERS)[number]

/** The name of each filter, as its button reads. */
export const EXTRACTION_RESULT_FILTER_LABELS = {
  all: msg({ message: "All", comment: "The filter that shows every result of a run" }),
  mismatches: msg({
    message: "Mismatches",
    comment: "The filter of the results where a field differs from the value expected",
  }),
  errors: msg({ message: "Errors", comment: "The filter of the results an error stopped" }),
  matches: msg({
    message: "Matches",
    comment: "The filter of the results where every scored field has the value expected",
  }),
  waiting: msg({
    message: "Waiting",
    comment: "The filter of the results the agent has not answered yet",
  }),
  notAsked: msg({
    message: "Not asked",
    comment: "The filter of the results a cancelled run never asked",
  }),
} satisfies Record<ExtractionResultFilter, MessageDescriptor>

const PREDICATES = {
  all: () => true,
  mismatches: (record) => record.status === "mismatch",
  errors: (record) => record.status === "error",
  matches: (record) => record.status === "match",
  waiting: (record) => record.status === "running",
  notAsked: (record) => record.status === "cancelled",
} satisfies Record<ExtractionResultFilter, (record: ExtractionRunRecordOutputDto) => boolean>

/** The records a filter keeps. */
export const filterExtractionResults = (
  records: ExtractionRunRecordOutputDto[],
  filter: ExtractionResultFilter,
) => records.filter(PREDICATES[filter])
