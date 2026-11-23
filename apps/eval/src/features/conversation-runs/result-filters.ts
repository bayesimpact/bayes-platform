import type { ConversationRunRecordOutputDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** A score at or under it counts as low: the answers worth reading first. */
const LOW_SCORE_MAX = 2

/** What the table of a run's results can be narrowed to. */
export const RESULT_FILTERS = ["all", "errors", "lowScores", "waiting", "notAsked"] as const

export type ResultFilter = (typeof RESULT_FILTERS)[number]

/** The name of each filter, as its button reads. */
export const RESULT_FILTER_LABELS = {
  all: msg({ message: "All", comment: "The filter that shows every result of a run" }),
  errors: msg({ message: "Errors", comment: "The filter of the results an error stopped" }),
  lowScores: msg({
    message: "Low scores",
    comment: "The filter of the results the judge graded 2 out of 5 or less",
  }),
  waiting: msg({
    message: "Waiting",
    comment: "The filter of the results the agent has not answered yet",
  }),
  notAsked: msg({
    message: "Not asked",
    comment: "The filter of the results a cancelled run never asked",
  }),
} satisfies Record<ResultFilter, MessageDescriptor>

const PREDICATES = {
  all: () => true,
  errors: (record) => record.status === "error",
  lowScores: (record) => record.score !== null && record.score <= LOW_SCORE_MAX,
  waiting: (record) => record.status === "running",
  notAsked: (record) => record.status === "cancelled",
} satisfies Record<ResultFilter, (record: ConversationRunRecordOutputDto) => boolean>

/**
 * The filter that shows, of the one the URL names: a name the app does not know, or a filter that
 * keeps nothing, or no longer as a run under way moves on, gives way to the one that shows every
 * result.
 */
export function shownResultFilterOf(
  records: ConversationRunRecordOutputDto[],
  asked: string | undefined,
): ResultFilter {
  const filter = RESULT_FILTERS.find((candidate) => candidate === asked)
  return filter && filterResults(records, filter).length > 0 ? filter : "all"
}

/** The records a filter keeps. */
export const filterResults = (records: ConversationRunRecordOutputDto[], filter: ResultFilter) =>
  records.filter(PREDICATES[filter])
