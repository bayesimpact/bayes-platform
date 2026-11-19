import {
  CONVERSATION_RUN_MAX_SCORE,
  type ConversationRunStatusDto,
} from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** Where a run stands, as the app says it. */
export const RUN_STATUS_LABELS = {
  pending: msg({ message: "Waiting", comment: "A run that has not started yet" }),
  running: msg({ message: "Running", comment: "A run that asks the agent its records" }),
  completed: msg({ message: "Completed", comment: "A run that is over" }),
  failed: msg({ message: "Failed", comment: "A run that an error stopped" }),
  cancelled: msg({ message: "Cancelled", comment: "A run that a person stopped" }),
} satisfies Record<ConversationRunStatusDto, MessageDescriptor>

/** Whether a run still changes on its own: its figures are then read again every few seconds. */
export const isRunActive = (status: ConversationRunStatusDto) =>
  status === "pending" || status === "running"

/** How often an active run is read again, in milliseconds. */
export const ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS = 3000

/**
 * A score out of the best one, such as 4 / 5: the score of an answer, a whole number, or the
 * average of a run, with one decimal at most.
 */
export const scoreOf = (score: number, locale: string) => {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  return `${format.format(score)} / ${format.format(CONVERSATION_RUN_MAX_SCORE)}`
}

/** The order of the groups of runs: what is under way, then what is over, then what did not end well. */
export const RUN_STATUS_ORDER = [
  "running",
  "pending",
  "completed",
  "failed",
  "cancelled",
] as const satisfies ConversationRunStatusDto[]
