import {
  type AgentParamsDto,
  type ConversationDatasetParamsDto,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
} from "@caseai-connect/eval-contracts"
import { useLingui } from "@lingui/react/macro"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import type { DatasetAction } from "@/components/shared/DatasetDialogs"
import { DatasetPageFrame, type DatasetTab } from "@/components/shared/DatasetPageFrame"
import { type EvaluationAgent, hasProjectPermission } from "@/features/agents"
import { ConversationRunsSection, useConversationRunEndToasts } from "@/features/conversation-runs"
import { projectConversationDatasetsQueryOptions } from "../api/queries"
import { ConversationDatasetDialogs } from "./ConversationDatasetDialogs"
import { ConversationRecordsSection } from "./ConversationRecordsSection"

export type ConversationDatasetPageProps = {
  agent: EvaluationAgent
  agentParams: AgentParamsDto
  datasetParams: ConversationDatasetParamsDto
  /** The tab shown: the dataset's records, or its runs. */
  tab: DatasetTab
}

/**
 * A conversation dataset: its name, which its owner changes, its records and its runs, in two
 * tabs, with the way to a new evaluation of the agent on it.
 */
export function ConversationDatasetPage({
  agent,
  agentParams,
  datasetParams,
  tab,
}: ConversationDatasetPageProps) {
  const { t } = useLingui()
  const navigate = useNavigate()
  const { data: datasets } = useSuspenseQuery(
    projectConversationDatasetsQueryOptions(datasetParams),
  )
  const [action, setAction] = useState<DatasetAction | null>(null)
  useConversationRunEndToasts(datasetParams)
  const dataset = datasets.find((candidate) => candidate.id === datasetParams.datasetId)
  // The loader found the dataset: it is missing only while its deletion leaves the page.
  if (!dataset) return null
  const can = (permission: string) => hasProjectPermission(agent.project, permission)
  const canUpdate = can(EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION)
  return (
    <DatasetPageFrame
      agentParams={agentParams}
      dataset={dataset}
      tab={tab}
      run={
        can(EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION)
          ? { disabledReason: dataset.recordCount === 0 ? t`Add a record first.` : null }
          : null
      }
      onRename={canUpdate ? () => setAction({ kind: "rename", dataset }) : null}
      onDelete={
        can(EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION)
          ? () => setAction({ kind: "delete", dataset })
          : null
      }
    >
      {tab === "runs" ? (
        <ConversationRunsSection
          agentParams={agentParams}
          agentName={agent.name}
          dataset={datasetParams}
          canDelete={can(EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION)}
        />
      ) : (
        <ConversationRecordsSection dataset={datasetParams} canEdit={canUpdate} />
      )}
      <ConversationDatasetDialogs
        project={datasetParams}
        action={action}
        onClose={() => setAction(null)}
        onDeleted={() =>
          void navigate({
            to: "/o/$organizationId/p/$projectId/a/$agentId/evaluations",
            params: agentParams,
          })
        }
      />
    </DatasetPageFrame>
  )
}
