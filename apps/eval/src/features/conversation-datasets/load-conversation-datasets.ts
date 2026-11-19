import type { ConversationDatasetParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
import {
  conversationDatasetRecordsQueryOptions,
  projectConversationDatasetsQueryOptions,
} from "./api/queries"

/** Loads the conversation datasets of a project, for the evaluations of one of its agents. */
export async function loadConversationDatasets(
  queryClient: QueryClient,
  project: ProjectParamsDto,
) {
  await orNotFound(() =>
    queryClient.query({
      ...projectConversationDatasetsQueryOptions(project),
      staleTime: loaderStaleTime,
    }),
  )
}

/**
 * Loads a dataset's page: the project's datasets, which hold its name, and all its records.
 * A dataset the project does not hold is not found.
 */
export async function loadConversationDataset(
  queryClient: QueryClient,
  dataset: ConversationDatasetParamsDto,
) {
  const [datasets] = await orNotFound(() =>
    Promise.all([
      queryClient.query({
        ...projectConversationDatasetsQueryOptions(dataset),
        staleTime: loaderStaleTime,
      }),
      queryClient.query({
        ...conversationDatasetRecordsQueryOptions(dataset),
        staleTime: loaderStaleTime,
      }),
    ]),
  )
  if (!datasets.some((candidate) => candidate.id === dataset.datasetId)) throw notFound()
}
