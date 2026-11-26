import { SidebarMenuSubButton, SidebarMenuSubItem } from "@caseai-connect/app-ui/components/sidebar"
import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { Link, useParams } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { SidebarSection } from "./SidebarSection"
import { SidebarSubGroupLabel } from "./SidebarSubGroupLabel"

export type DatasetSidebarLinksProps = {
  agentParams: AgentParamsDto
  /** The datasets of the agent's project, the last changed first. */
  datasets: { id: string; name: string }[]
  /** The runs of the open dataset, which load on their own: `RunSidebarLinks`. */
  renderRuns: (datasetId: string) => ReactNode
}

/** Each dataset of a project, in the sidebar: the open one lists its runs under it. */
export function DatasetSidebarLinks({
  agentParams,
  datasets,
  renderRuns,
}: DatasetSidebarLinksProps) {
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
              {renderRuns(dataset.id)}
            </SidebarSection>
          ) : null}
        </SidebarMenuSubItem>
      ))}
    </>
  )
}
