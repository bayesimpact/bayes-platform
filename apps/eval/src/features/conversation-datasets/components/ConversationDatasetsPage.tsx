import {
  type AgentParamsDto,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { FlaskConicalIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { PageContainer } from "@/components/shared/PageContainer"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { projectConversationDatasetsQueryOptions } from "../api/queries"
import {
  type ConversationDatasetAction,
  ConversationDatasetDialogs,
} from "./ConversationDatasetDialogs"
import { ConversationDatasetsTable } from "./ConversationDatasetsTable"

export type ConversationDatasetsPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
}

/**
 * The evaluations of a conversation agent: the datasets of its project, which every conversation
 * agent of the project shares, with the way to a new one.
 */
export function ConversationDatasetsPage({ agent, agentParams }: ConversationDatasetsPageProps) {
  const { data: datasets } = useSuspenseQuery(projectConversationDatasetsQueryOptions(agentParams))
  const [action, setAction] = useState<ConversationDatasetAction | null>(null)
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const newDatasetButton = can(EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION) ? (
    <Button onClick={() => setAction({ kind: "create" })}>
      <PlusIcon data-icon="inline-start" aria-hidden />
      <Trans>New dataset</Trans>
    </Button>
  ) : null
  return (
    <PageContainer>
      <PageHeader
        title={<Trans>Evaluations</Trans>}
        description={
          <Trans>
            Ask this agent the questions of a dataset, and have a model grade its answers.
          </Trans>
        }
        actions={datasets.length > 0 ? newDatasetButton : null}
      />
      {datasets.length === 0 ? (
        <StatusPage
          icon={<FlaskConicalIcon aria-hidden />}
          title={<Trans>No dataset yet</Trans>}
          description={<Trans>Create a dataset, then add the questions to ask the agent.</Trans>}
          action={newDatasetButton}
        />
      ) : (
        <ConversationDatasetsTable
          agent={agentParams}
          datasets={datasets}
          onRename={
            can(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION)
              ? (dataset) => setAction({ kind: "rename", dataset })
              : null
          }
          onDelete={
            can(EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION)
              ? (dataset) => setAction({ kind: "delete", dataset })
              : null
          }
        />
      )}
      <ConversationDatasetDialogs
        project={agentParams}
        action={action}
        onClose={() => setAction(null)}
      />
    </PageContainer>
  )
}
