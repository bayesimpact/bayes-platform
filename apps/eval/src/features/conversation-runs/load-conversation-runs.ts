import type {
  AgentParamsDto,
  ConversationRunParamsDto,
  ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { loaderStaleTime } from "@caseai-connect/frontend-lib"
import type { QueryClient } from "@tanstack/react-query"
import { agentVersionsQueryOptions } from "@/features/agents"
import { orNotFound } from "@/lib/not-found"
import {
  conversationRunQueryOptions,
  conversationRunRecordsQueryOptions,
  judgeModelsQueryOptions,
  projectConversationRunsQueryOptions,
} from "./api/queries"

/**
 * Loads what every page of the runs reads: the project's runs, and the agent's saved versions,
 * which a run's version opens.
 */
export async function loadConversationRuns(queryClient: QueryClient, agent: AgentParamsDto) {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...projectConversationRunsQueryOptions(agent),
        staleTime: loaderStaleTime,
      }),
      queryClient.query({ ...agentVersionsQueryOptions(agent), staleTime: loaderStaleTime }),
    ]),
  )
}

/** Loads the project's models that can judge a run, which the form of a new run picks from. */
export async function loadJudgeModels(queryClient: QueryClient, project: ProjectParamsDto) {
  await orNotFound(() =>
    queryClient.query({ ...judgeModelsQueryOptions(project), staleTime: loaderStaleTime }),
  )
}

/**
 * Loads a run's page: the run, and all its records. A run of another dataset, or of another
 * agent, is not found: the page shows one agent's runs.
 */
export async function loadConversationRun(
  queryClient: QueryClient,
  run: ConversationRunParamsDto,
  { datasetId, agentId }: { datasetId: string; agentId: string },
) {
  const [loaded] = await orNotFound(() =>
    Promise.all([
      queryClient.query({ ...conversationRunQueryOptions(run), staleTime: loaderStaleTime }),
      queryClient.query({
        ...conversationRunRecordsQueryOptions(run),
        staleTime: loaderStaleTime,
      }),
    ]),
  )
  return loaded.evaluationConversationDatasetId === datasetId && loaded.agentId === agentId
}

/**
 * Loads the comparison of runs: the records of each of them. A run that is gone, or of another
 * project, is left out: the page says so.
 */
export async function loadConversationRunsComparison(
  queryClient: QueryClient,
  project: ProjectParamsDto,
  runIds: string[],
) {
  await Promise.allSettled(
    runIds.map((runId) =>
      queryClient.query({
        ...conversationRunRecordsQueryOptions(runParamsOf(project, runId)),
        staleTime: loaderStaleTime,
      }),
    ),
  )
}

/** The agent a run asked, for a URL that names the run and not its agent: none for a run that is gone. */
export async function loadConversationRunAgentId(
  queryClient: QueryClient,
  project: ProjectParamsDto,
  runId: string,
): Promise<string | null> {
  try {
    const run = await queryClient.query({
      ...conversationRunQueryOptions(runParamsOf(project, runId)),
      staleTime: loaderStaleTime,
    })
    return run.agentId
  } catch {
    return null
  }
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
