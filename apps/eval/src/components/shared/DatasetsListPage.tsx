import type { AgentParamsDto } from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useNavigate } from "@tanstack/react-router"
import { FlaskConicalIcon, PlusIcon } from "lucide-react"
import { type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import type { DatasetAction } from "./DatasetDialogs"
import { DatasetsTable } from "./DatasetsTable"
import type { DatasetSummary } from "./dataset-columns"
import { PageContainer } from "./PageContainer"
import { PageHeader } from "./PageHeader"
import { StatusPage } from "./StatusPage"

export type DatasetsListPageProps = {
  agentParams: AgentParamsDto
  /** The datasets of the agent's project, the last changed first. */
  datasets: DatasetSummary[]
  /** Whether the dialog that names a new dataset shows: the `create` search param. */
  isCreating: boolean
  /** What an evaluation of this type of agent does, under the page's title. */
  description: ReactNode
  /** What to do first, on a project with no dataset. */
  emptyDescription: ReactNode
  /** What the person may do to the project's datasets. */
  can: { create: boolean; rename: boolean; delete: boolean }
  /** The dialogs of the feature, for the action under way. */
  renderDialogs: (dialogs: { action: DatasetAction | null; onClose: () => void }) => ReactNode
}

/**
 * The evaluations of an agent of any type: the datasets of its project, with the way to a new
 * one. The feature gives the datasets, the texts and the dialogs.
 */
export function DatasetsListPage({
  agentParams,
  datasets,
  isCreating,
  description,
  emptyDescription,
  can,
  renderDialogs,
}: DatasetsListPageProps) {
  const navigate = useNavigate()
  const [rowAction, setRowAction] = useState<DatasetAction | null>(null)
  // The new dataset's dialog is in the URL, so the sidebar's New dataset opens it from any page.
  const setCreating = (isOpen: boolean) =>
    void navigate({
      to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
      params: agentParams,
      search: { create: isOpen ? true : undefined },
    })
  const newDatasetButton = can.create ? (
    <Button onClick={() => setCreating(true)}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      <Trans>New dataset</Trans>
    </Button>
  ) : null
  return (
    <PageContainer>
      <PageHeader
        title={<Trans>Evaluations</Trans>}
        description={description}
        actions={datasets.length > 0 ? newDatasetButton : null}
      />
      {datasets.length === 0 ? (
        <StatusPage
          icon={<FlaskConicalIcon aria-hidden />}
          title={<Trans>No dataset yet</Trans>}
          description={emptyDescription}
          action={newDatasetButton}
        />
      ) : (
        <DatasetsTable
          agent={agentParams}
          datasets={datasets}
          onRename={can.rename ? (dataset) => setRowAction({ kind: "rename", dataset }) : null}
          onDelete={can.delete ? (dataset) => setRowAction({ kind: "delete", dataset }) : null}
        />
      )}
      {renderDialogs({
        action: can.create && isCreating ? { kind: "create" } : rowAction,
        onClose: () => {
          setRowAction(null)
          if (isCreating) setCreating(false)
        },
      })}
    </PageContainer>
  )
}
