import type {
  AgentParamsDto,
  ConversationRunParamsDto,
  ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
import {
  agentSavedVersionsQueryOptions,
  conversationRunQueryOptions,
  conversationRunRecordsQueryOptions,
  judgeModelsQueryOptions,
  projectConversationRunsQueryOptions,
} from "./api/queries"

/**
 * Loads what a dataset's page reads about runs: the project's runs, and what a new run picks
 * from, the agent's saved versions and the project's models.
 */
export async function loadConversationRuns(queryClient: QueryClient, agent: AgentParamsDto) {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...projectConversationRunsQueryOptions(agent),
        staleTime: loaderStaleTime,
      }),
      queryClient.query({ ...agentSavedVersionsQueryOptions(agent), staleTime: loaderStaleTime }),
      queryClient.query({ ...judgeModelsQueryOptions(agent), staleTime: loaderStaleTime }),
    ]),
  )
}

/** Loads a run's page: the run, and a page of its records. A run of another dataset is not found. */
export async function loadConversationRun(
  queryClient: QueryClient,
  run: ConversationRunParamsDto,
  { page, datasetId }: { page: number; datasetId: string },
) {
  const [loaded] = await orNotFound(() =>
    Promise.all([
      queryClient.query({ ...conversationRunQueryOptions(run), staleTime: loaderStaleTime }),
      queryClient.query({
        ...conversationRunRecordsQueryOptions(run, page),
        staleTime: loaderStaleTime,
      }),
    ]),
  )
  return loaded.evaluationConversationDatasetId === datasetId
}

/** The params of a project's routes, from an agent's: a run belongs to the project. */
export const runParamsOf = (
  project: ProjectParamsDto,
  runId: string,
): ConversationRunParamsDto => ({
  organizationId: project.organizationId,
  projectId: project.projectId,
  evaluationConversationRunId: runId,
})
