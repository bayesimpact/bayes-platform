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
import { type ExtractionResultFilter, resultFiltersOf, shownResultFilterOf } from "./result-filters"
import type { ExtractionRunSearch } from "./schemas"

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

/**
 * Loads a run's page: the run. The page of its results the URL names starts too, and blocks
 * nothing: the table waits for it. A run of another dataset, or of another agent, is not found:
 * the page shows one agent's runs.
 */
export async function loadExtractionRun(
  queryClient: QueryClient,
  run: ExtractionRunParamsDto,
  { datasetId, agentId }: { datasetId: string; agentId: string },
  { result, ...recordsSearch }: ExtractionRunSearch,
) {
  const startResults = (filter: ExtractionResultFilter) =>
    void queryClient.prefetchQuery({
      ...extractionRunRecordsQueryOptions(run, recordsSearch, { filters: resultFiltersOf(filter) }),
      staleTime: loaderStaleTime,
    })
  // With no filter in the URL, every result shows: their page starts with the run.
  if (!result) startResults("all")
  const loaded = await orNotFound(() =>
    queryClient.query({ ...extractionRunQueryOptions(run), staleTime: loaderStaleTime }),
  )
  // A filter shows only while the run holds results for it, which the run tells.
  if (result) startResults(shownResultFilterOf(loaded, result))
  return loaded.evaluationExtractionDatasetId === datasetId && loaded.agentId === agentId
}

/** The agent a run asked, for a URL that names the run and not its agent: none for a run that is gone. */
export async function loadExtractionRunAgentId(
  queryClient: QueryClient,
  project: ProjectParamsDto,
  runId: string,
): Promise<string | null> {
  try {
    const run = await queryClient.query({
      ...extractionRunQueryOptions(extractionRunParamsOf(project, runId)),
      staleTime: loaderStaleTime,
    })
    return run.agentId
  } catch {
    return null
  }
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
