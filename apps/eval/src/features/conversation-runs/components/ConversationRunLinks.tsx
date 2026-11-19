import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { SidebarSessionItem } from "@/components/shared/SidebarSessionItem"
import { SidebarMenuSub } from "@/components/ui/sidebar"
import { shortDateTimeOf } from "@/lib/format-time"
import { projectConversationRunsQueryOptions } from "../api/queries"
import { RUN_STATUS_LABELS } from "../run-status"

export type ConversationRunLinksProps = {
  agentParams: AgentParamsDto
  datasetId: string
}

/**
 * The runs of the open dataset, under it in the sidebar, the newest first: each by when it
 * started, with a mark once it is over, and a struck circle when it failed.
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
      {runs.map((run) => (
        <SidebarSessionItem
          key={run.id}
          link={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId/runs/$runId"
              params={{ ...agentParams, datasetId, runId: run.id }}
              activeProps={{ "data-active": true }}
            />
          }
          label={shortDateTimeOf(run.createdAt, i18n.locale)}
          isDone={run.status === "completed"}
          hasFailed={run.status === "failed"}
          stateLabel={i18n._(RUN_STATUS_LABELS[run.status])}
        />
      ))}
    </SidebarMenuSub>
  )
}
