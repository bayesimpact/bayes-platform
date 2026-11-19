import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SidebarSubGroupLabel } from "@/components/shared/SidebarSubGroupLabel"
import { SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { shortDateTimeOf } from "@/lib/format-time"
import { projectConversationRunsQueryOptions } from "../api/queries"
import { RUN_STATUS_LABELS, RUN_STATUS_ORDER } from "../run-status"

export type ConversationRunLinksProps = {
  agentParams: AgentParamsDto
  datasetId: string
}

/**
 * The runs of the open dataset, under it in the sidebar, grouped by where they stand: each by
 * when it started, the newest first.
 */
export function ConversationRunLinks({ agentParams, datasetId }: ConversationRunLinksProps) {
  const { i18n } = useLingui()
  const { data: projectRuns } = useSuspenseQuery(projectConversationRunsQueryOptions(agentParams))
  const runs = projectRuns.filter((run) => run.evaluationConversationDatasetId === datasetId)
  if (runs.length === 0) {
    return (
      <p className="px-4 py-1 text-xs text-muted-foreground">
        <Trans comment="Under a dataset in the sidebar, when no evaluation ran on it">
          No run yet.
        </Trans>
      </p>
    )
  }
  return (
    <SidebarMenuSub className="mr-0 pr-0">
      {RUN_STATUS_ORDER.map((status) => {
        const group = runs.filter((run) => run.status === status)
        if (group.length === 0) return null
        return [
          <SidebarSubGroupLabel key={status}>
            {i18n._(RUN_STATUS_LABELS[status])}
          </SidebarSubGroupLabel>,
          ...group.map((run) => (
            <SidebarMenuSubItem key={run.id}>
              <SidebarMenuSubButton
                render={
                  <Link
                    to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
                    params={{ ...agentParams, datasetId, runId: run.id }}
                    activeProps={{ "data-active": true }}
                  />
                }
              >
                <span className="truncate">{shortDateTimeOf(run.createdAt, i18n.locale)}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          )),
        ]
      })}
    </SidebarMenuSub>
  )
}
