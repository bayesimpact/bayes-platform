import type { ConversationRunStatusDto } from "@caseai-connect/eval-contracts"
import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** Where a run of an evaluation stands, whatever the type of its agent. */
export type RunStatus = ConversationRunStatusDto

/** Where a run stands, as the app says it. */
export const RUN_STATUS_LABELS = {
  pending: msg({ message: "Waiting", comment: "A run that has not started yet" }),
  running: msg({ message: "Running", comment: "A run that asks the agent its records" }),
  completed: msg({ message: "Completed", comment: "A run that is over" }),
  failed: msg({ message: "Failed", comment: "A run that an error stopped" }),
  cancelled: msg({ message: "Cancelled", comment: "A run that a person stopped" }),
} satisfies Record<RunStatus, MessageDescriptor>

/** Whether a run still changes on its own: its figures are then read again every few seconds. */
export const isRunActive = (status: RunStatus) => status === "pending" || status === "running"

/** How often an active run is read again, in milliseconds. */
export const ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS = 3000

/** The order of the groups of runs: what is under way, then what is over, then what did not end well. */
export const RUN_STATUS_ORDER = [
  "running",
  "pending",
  "completed",
  "failed",
  "cancelled",
] as const satisfies RunStatus[]

/** What a run's row, link or page needs of a run, whatever the type of its agent. */
export type RunSummary = {
  id: string
  status: RunStatus
  createdAt: number
  updatedAt: number
}
