import {
  type AgentParamsDto,
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DatasetsListPage } from "@/components/shared/DatasetsListPage"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { projectExtractionDatasetsQueryOptions } from "../api/queries"
import { ExtractionDatasetDialogs } from "./ExtractionDatasetDialogs"

export type ExtractionDatasetsPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** Whether the dialog that names a new dataset shows: the `create` search param. */
  isCreating: boolean
}

/**
 * The evaluations of an extraction agent: the datasets of its project, which every extraction
 * agent of the project shares, with the way to a new one.
 */
export function ExtractionDatasetsPage({
  agent,
  agentParams,
  isCreating,
}: ExtractionDatasetsPageProps) {
  const { data: datasets } = useSuspenseQuery(projectExtractionDatasetsQueryOptions(agentParams))
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  return (
    <DatasetsListPage
      agentParams={agentParams}
      datasets={datasets}
      isCreating={isCreating}
      description={
        <Trans>
          Give this agent the rows of a dataset, and compare what it extracts with the values
          expected.
        </Trans>
      }
      emptyDescription={<Trans>Create a dataset, then build its records from a CSV file.</Trans>}
      can={{
        create: can(EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION),
        rename: can(EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION),
        delete: can(EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION),
      }}
      renderDialogs={(dialogs) => <ExtractionDatasetDialogs project={agentParams} {...dialogs} />}
    />
  )
}
