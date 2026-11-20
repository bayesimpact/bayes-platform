import type {
  ExtractionRunOutputDto,
  ExtractionRunRecordStatusDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"
import { isRunActive } from "@/lib/run-status"

/**
 * What the table of a run's results can be narrowed to: the API keeps the records whose status
 * holds a text, so the matches, whose name the mismatches hold too, are not among them.
 */
export const EXTRACTION_RESULT_FILTERS = [
  "all",
  "mismatches",
  "errors",
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
  waiting: msg({
    message: "Waiting",
    comment: "The filter of the results the agent has not answered yet",
  }),
  notAsked: msg({
    message: "Not asked",
    comment: "The filter of the results a cancelled run never asked",
  }),
} satisfies Record<ExtractionResultFilter, MessageDescriptor>

/** The status of the records a filter keeps: none for the filter that keeps them all. */
const STATUSES = {
  all: null,
  mismatches: "mismatch",
  errors: "error",
  waiting: "running",
  notAsked: "cancelled",
} satisfies Record<ExtractionResultFilter, ExtractionRunRecordStatusDto | null>

/**
 * The filter that shows, of the one the URL names: a filter that keeps nothing, or no longer as a
 * run under way moves on, gives way to the one that shows every result.
 */
export function shownResultFilterOf(
  run: Pick<ExtractionRunOutputDto, "status" | "summary">,
  asked: ExtractionResultFilter | undefined,
): ExtractionResultFilter {
  return asked && asked !== "all" && resultCountsOf(run)[asked] > 0 ? asked : "all"
}

/** What a filter asks the API, beside the search: the status of the records it keeps. */
export function resultFiltersOf(filter: ExtractionResultFilter): Record<string, string> {
  const status = STATUSES[filter]
  return status ? { status } : {}
}

/**
 * How many records each filter keeps, from the figures of the run. A record waits only while the
 * run goes on: once a run is over, the records its figures still count as waiting were left out,
 * as the figures of a cancelled run are not counted again.
 */
export function resultCountsOf({
  status,
  summary,
}: Pick<ExtractionRunOutputDto, "status" | "summary">): Record<ExtractionResultFilter, number> {
  if (!summary) return { all: 0, mismatches: 0, errors: 0, waiting: 0, notAsked: 0 }
  const { total, perfectMatches, mismatches, errors, running } = summary
  const isActive = isRunActive(status)
  const leftOut = Math.max(0, total - perfectMatches - mismatches - errors - running)
  return {
    all: total,
    mismatches,
    errors,
    waiting: isActive ? running : 0,
    notAsked: isActive ? leftOut : leftOut + running,
  }
}
