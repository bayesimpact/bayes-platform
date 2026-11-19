import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans, useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { ListIcon, PlusIcon } from "lucide-react"
import { SidebarSection } from "@/components/shared/SidebarSection"
import { SidebarSubGroupLabel } from "@/components/shared/SidebarSubGroupLabel"
import { SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { ConversationRunLinks } from "@/features/conversation-runs"
import { projectConversationDatasetsQueryOptions } from "../api/queries"

export type ConversationDatasetsSidebarEntriesProps = {
  agentParams: AgentParamsDto
  /** Whether the person creates datasets: the menu then leads to a new one. */
  canCreate: boolean
}

/**
 * The entries of the sidebar's Evaluations menu for a conversation agent: the table of its
 * project's datasets, the way to a new one, then each dataset, the last changed first. The open dataset lists its runs under it.
 */
export function ConversationDatasetsSidebarEntries({
  agentParams,
  canCreate,
}: ConversationDatasetsSidebarEntriesProps) {
  const { t } = useLingui()
  return (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          render={
            <Link
              to="/o/$organizationId/p/$projectId/a/$agentId/evaluations"
              params={agentParams}
              activeOptions={{ exact: true }}
              activeProps={{ "data-active": true }}
              // The Campaigns menu has a List all too: this one says what it lists.
              aria-label={t`List all datasets`}
            />
          }
        >
          <ListIcon aria-hidden />
          <span>
            <Trans comment="The sidebar's link to the table of all the datasets of an agent's project">
              List all
            </Trans>
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {canCreate ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            render={
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/evaluations"
                params={agentParams}
                search={{ create: true }}
                activeOptions={{ exact: true }}
                activeProps={{ "data-active": true }}
              />
            }
          >
            <PlusIcon aria-hidden />
            <span>
              <Trans>New dataset</Trans>
            </span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      <SidebarSection resetKey={agentParams.agentId}>
        <DatasetLinks agentParams={agentParams} />
      </SidebarSection>
    </>
  )
}

function DatasetLinks({
  agentParams,
}: Pick<ConversationDatasetsSidebarEntriesProps, "agentParams">) {
  const { data: datasets } = useSuspenseQuery(projectConversationDatasetsQueryOptions(agentParams))
  // The dataset whose page, or one of whose runs, shows.
  const openDatasetId = useParams({ strict: false, select: (params) => params.datasetId })
  if (datasets.length === 0) return null
  return (
    <>
      <SidebarSubGroupLabel>
        <Trans comment="Above the datasets of a project, in the sidebar">Datasets</Trans>
      </SidebarSubGroupLabel>
      {datasets.map((dataset) => (
        <SidebarMenuSubItem key={dataset.id}>
          <SidebarMenuSubButton
            render={
              <Link
                to="/o/$organizationId/p/$projectId/a/$agentId/evaluations/$datasetId"
                params={{ ...agentParams, datasetId: dataset.id }}
                // Its own page only: a run of the dataset marks its own entry, under it.
                activeOptions={{ exact: true, includeSearch: false }}
                activeProps={{ "data-active": true }}
              />
            }
          >
            <span className="truncate">{dataset.name}</span>
          </SidebarMenuSubButton>
          {/* The open dataset lists its runs under it. */}
          {dataset.id === openDatasetId ? (
            <SidebarSection resetKey={`runs-${dataset.id}`}>
              <ConversationRunLinks agentParams={agentParams} datasetId={dataset.id} />
            </SidebarSection>
          ) : null}
        </SidebarMenuSubItem>
      ))}
    </>
  )
}
