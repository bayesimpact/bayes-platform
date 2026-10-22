import { Trans, useLingui } from "@lingui/react/macro"
import { Link } from "@tanstack/react-router"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { agentParamsOf } from "@/lib/agent-params"
import type { HistoryAgent, HistoryEntry } from "../history-entries"

export type HistoryEntryLinkProps = {
  agent: HistoryAgent
  entry: HistoryEntry
}

/** One line of the history, which opens its conversation or extraction. */
export function HistoryEntryLink({ agent, entry }: HistoryEntryLinkProps) {
  const agentParams = agentParamsOf(agent)
  const className = "data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium"
  switch (entry.kind) {
    case "conversation":
      return (
        <SidebarMenuButton
          className={className}
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/as/$agentSessionId"
              params={{ ...agentParams, agentSessionId: entry.id }}
            />
          }
        >
          <span className="truncate">{entry.title ?? <Trans>New conversation</Trans>}</span>
        </SidebarMenuButton>
      )
    case "extraction":
      return (
        <SidebarMenuButton
          className={className}
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/extraction/runs/$extractionRunId"
              params={{ ...agentParams, extractionRunId: entry.id }}
            />
          }
        >
          <span className="truncate">{entry.fileName ?? <Trans>Untitled document</Trans>}</span>
          <RunStateMark state={entry.state} />
        </SidebarMenuButton>
      )
    case "csv":
      return (
        <SidebarMenuButton
          className={className}
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/extraction/csv-runs/$csvRunId"
              params={{ ...agentParams, csvRunId: entry.id }}
            />
          }
        >
          <span className="truncate">
            {entry.fileName ?? (
              <Trans comment="An extraction of every row of a spreadsheet">CSV extraction</Trans>
            )}
          </span>
          <RunStateMark state={entry.state} />
        </SidebarMenuButton>
      )
  }
}

type RunStateMarkProps = {
  state: Extract<HistoryEntry, { state: unknown }>["state"]
}

/** A small mark on the extractions still running or failed; nothing on the ones done. */
function RunStateMark({ state }: RunStateMarkProps) {
  const { t } = useLingui()
  if (state === "pending")
    return (
      <LoaderCircleIcon
        role="img"
        aria-label={t`In progress`}
        className="ml-auto animate-spin text-muted-foreground motion-reduce:animate-none"
      />
    )
  if (state === "failed")
    return (
      <CircleAlertIcon role="img" aria-label={t`Failed`} className="ml-auto text-destructive" />
    )
  return null
}
