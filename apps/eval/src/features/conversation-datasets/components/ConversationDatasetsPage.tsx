import {
  type AgentParamsDto,
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { Trans } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
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
  const navigate = useNavigate()
  const [rowAction, setRowAction] = useState<ConversationDatasetAction | null>(null)
  // The new dataset's dialog is in the URL, so the sidebar's New dataset opens it from any page.
  const setCreating = (isOpen: boolean) =>
    void navigate({
      to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
      params: agentParams,
      search: { create: isOpen ? true : undefined },
    })
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canCreate = can(EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION)
  const newDatasetButton = canCreate ? (
    <Button onClick={() => setCreating(true)}>
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
              ? (dataset) => setRowAction({ kind: "rename", dataset })
              : null
          }
          onDelete={
            can(EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION)
              ? (dataset) => setRowAction({ kind: "delete", dataset })
              : null
          }
        />
      )}
      <ConversationDatasetDialogs
        project={agentParams}
        action={canCreate && isCreating ? { kind: "create" } : rowAction}
        onClose={() => {
          setRowAction(null)
          if (isCreating) setCreating(false)
        }}
      />
    </PageContainer>
  )
}
