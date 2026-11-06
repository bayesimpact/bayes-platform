import type { MessageDescriptor } from "@lingui/core"
import { msg } from "@lingui/core/macro"

/** Where a run stands, as every run of the Desk shows it: an extraction, a CSV run, one of its rows. */
export type RunState = "starting" | "running" | "done" | "failed" | "stopped"

/** The name of each state, which a badge shows and an icon carries for screen readers. */
export const RUN_STATE_LABELS = {
  starting: msg({ message: "Starting", comment: "A run waiting for its turn" }),
  running: msg({ message: "In progress", comment: "A run going on" }),
  done: msg({ message: "Done", comment: "A run that ended well" }),
  failed: msg({ message: "Failed", comment: "A run that ended with an error" }),
  stopped: msg({ message: "Stopped", comment: "A run the person stopped" }),
} as const satisfies Record<RunState, MessageDescriptor>

/** Whether a run in this state still goes on. */
export const isLiveRunState = (state: RunState): boolean =>
  state === "starting" || state === "running"
