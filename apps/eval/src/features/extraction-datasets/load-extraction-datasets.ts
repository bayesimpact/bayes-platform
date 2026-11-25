import type { ExtractionDatasetParamsDto, ProjectParamsDto } from "@bayes-platform/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { isSetUp } from "@/lib/extraction-columns"
import { orNotFound } from "@/lib/not-found"
import type { RecordsSearch } from "@/lib/records-search"
import { loaderStaleTime } from "@/lib/start-query"
import {
  extractionDatasetRecordsQueryOptions,
  extractionFilesQueryOptions,
  projectExtractionDatasetsQueryOptions,
} from "./api/queries"

/**
 * Starts reading the extraction datasets of an agent's project for the sidebar, which must not
 * hold the page back: nothing waits for it.
 */
export function prefetchExtractionDatasets(
  queryClient: QueryClient,
  project: ProjectParamsDto,
): void {
  void queryClient.prefetchQuery({
    ...projectExtractionDatasetsQueryOptions(project),
    staleTime: loaderStaleTime,
  })
}

/** Loads the extraction datasets of a project, for the evaluations of one of its agents. */
export async function loadExtractionDatasets(queryClient: QueryClient, project: ProjectParamsDto) {
  await orNotFound(() =>
    queryClient.query({
      ...projectExtractionDatasetsQueryOptions(project),
      staleTime: loaderStaleTime,
    }),
  )
}

/**
 * Loads a dataset's page: the project's datasets, which hold its name and its columns, and the
 * project's files while it waits for one. The page of its records the URL names starts with
 * them and blocks nothing: the table waits for it. A dataset the project does not hold is not
 * found.
 */
export async function loadExtractionDataset(
  queryClient: QueryClient,
  dataset: ExtractionDatasetParamsDto,
  recordsSearch: RecordsSearch,
) {
  void queryClient.prefetchQuery({
    ...extractionDatasetRecordsQueryOptions(dataset, recordsSearch),
    staleTime: loaderStaleTime,
  })
  const datasets = await orNotFound(() =>
    queryClient.query({
      ...projectExtractionDatasetsQueryOptions(dataset),
      staleTime: loaderStaleTime,
    }),
  )
  const loaded = datasets.find((candidate) => candidate.id === dataset.datasetId)
  if (!loaded) throw notFound()
  if (isSetUp(loaded)) return
  await orNotFound(() =>
    queryClient.query({ ...extractionFilesQueryOptions(dataset), staleTime: loaderStaleTime }),
  )
}
