import type { ConversationRunStatusDto } from "@caseai-connect/eval-contracts"
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

/** A score from 0 to 1 as a percentage of the locale, such as 92%. */
export const scoreOf = (score: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(score)
