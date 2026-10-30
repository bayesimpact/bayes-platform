import { useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { RunStateIcon } from "@/components/shared/RunStateIcon"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { RUN_STATE_LABELS, type RunState } from "@/lib/run-state"
import { entryLinkOptions } from "../entry-link"
import type { HistoryAgent, HistoryEntry, HistoryEntryState } from "../history-entries"

export type HistoryEntryLinkProps = {
  agent: HistoryAgent
  entry: HistoryEntry
  /** The entry's name, as `entryTitleOf` gives it. */
  title: string
}

const className = "data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium"

/** One line of the history, which opens its conversation or extraction. */
export function HistoryEntryLink({ agent, entry, title }: HistoryEntryLinkProps) {
  return (
    <SidebarMenuButton className={className} render={<Link {...entryLinkOptions(agent, entry)} />}>
      <span className="truncate">{title}</span>
      {entry.kind === "conversation" ? null : <RunStateMark state={entry.state} />}
    </SidebarMenuButton>
  )
}

/** The mark of an extraction in the history: while it runs and once it failed, none once done. */
const RUN_STATE_MARKS = {
  pending: "running",
  failed: "failed",
  done: null,
} as const satisfies Record<HistoryEntryState, RunState | null>

type RunStateMarkProps = {
  state: HistoryEntryState
}

function RunStateMark({ state }: RunStateMarkProps) {
  const { i18n } = useLingui()
  const runState = RUN_STATE_MARKS[state]
  if (!runState) return null
  return (
    <span role="img" aria-label={i18n._(RUN_STATE_LABELS[runState])} className="ml-auto flex">
      <RunStateIcon state={runState} isMuted className="size-4 shrink-0" />
    </span>
  )
}
