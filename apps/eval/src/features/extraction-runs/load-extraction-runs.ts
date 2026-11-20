import type {
  AgentParamsDto,
  ExtractionRunParamsDto,
  ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { agentVersionsQueryOptions } from "@/features/campaigns"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
import {
  extractionRunQueryOptions,
  extractionRunRecordsQueryOptions,
  projectExtractionRunsQueryOptions,
} from "./api/queries"

/**
 * Loads what a dataset's page reads about runs: the project's runs, and the agent's saved
 * versions, which a new run picks from.
 */
export async function loadExtractionRuns(queryClient: QueryClient, agent: AgentParamsDto) {
  await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...projectExtractionRunsQueryOptions(agent),
        staleTime: loaderStaleTime,
      }),
      queryClient.query({ ...agentVersionsQueryOptions(agent), staleTime: loaderStaleTime }),
    ]),
  )
}

/** Loads a run's page: the run, and all its records. A run of another dataset is not found. */
export async function loadExtractionRun(
  queryClient: QueryClient,
  run: ExtractionRunParamsDto,
  { datasetId }: { datasetId: string },
) {
  const [loaded] = await orNotFound(() =>
    Promise.all([
      queryClient.query({ ...extractionRunQueryOptions(run), staleTime: loaderStaleTime }),
      queryClient.query({ ...extractionRunRecordsQueryOptions(run), staleTime: loaderStaleTime }),
    ]),
  )
  return loaded.evaluationExtractionDatasetId === datasetId
}

/**
 * Loads the comparison of runs: the records of each of them. A run that is gone, or of another
 * project, is left out: the page says so.
 */
export async function loadExtractionRunsComparison(
  queryClient: QueryClient,
  project: ProjectParamsDto,
  runIds: string[],
) {
  await Promise.allSettled(
    runIds.map((runId) =>
      queryClient.query({
        ...extractionRunRecordsQueryOptions(extractionRunParamsOf(project, runId)),
        staleTime: loaderStaleTime,
      }),
    ),
  )
}

/** The params of a project's routes, from an agent's: a run belongs to the project. */
export const extractionRunParamsOf = (
  project: ProjectParamsDto,
  runId: string,
): ExtractionRunParamsDto => ({
  organizationId: project.organizationId,
  projectId: project.projectId,
  evaluationExtractionRunId: runId,
})
