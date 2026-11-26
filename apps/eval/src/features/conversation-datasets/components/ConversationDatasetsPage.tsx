import {
  type AgentParamsDto,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@bayes-platform/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { DatasetsListPage } from "@/components/shared/DatasetsListPage"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { projectConversationDatasetsQueryOptions } from "../api/queries"
import { ConversationDatasetDialogs } from "./ConversationDatasetDialogs"

export type ConversationDatasetsPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  /** Whether the dialog that names a new dataset shows: the `create` search param. */
  isCreating: boolean
}

/**
 * The evaluations of a conversation agent: the datasets of its project, which every conversation
 * agent of the project shares, with the way to a new one.
 */
export function ConversationDatasetsPage({
  agent,
  agentParams,
  isCreating,
}: ConversationDatasetsPageProps) {
  const { data: datasets } = useSuspenseQuery(projectConversationDatasetsQueryOptions(agentParams))
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  return (
    <DatasetsListPage
      agentParams={agentParams}
      datasets={datasets}
      isCreating={isCreating}
      description={
        <Trans>
          Ask this agent the questions of a dataset, and have a model grade its answers.
        </Trans>
      }
      emptyDescription={<Trans>Create a dataset, then add the questions to ask the agent.</Trans>}
      can={{
        create: can(EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION),
        rename: can(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION),
        delete: can(EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION),
      }}
      renderDialogs={(dialogs) => <ConversationDatasetDialogs project={agentParams} {...dialogs} />}
    />
  )
}
