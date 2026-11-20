import type { ExtractionDatasetParamsDto, ProjectParamsDto } from "@caseai-connect/eval-contracts"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { isSetUp } from "@/lib/extraction-columns"
import { orNotFound } from "@/lib/not-found"
import { loaderStaleTime } from "@/lib/start-query"
import {
  extractionDatasetRecordsQueryOptions,
  extractionFilesQueryOptions,
  projectExtractionDatasetsQueryOptions,
} from "./api/queries"

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
 * Loads a dataset's page: the project's datasets, which hold its name and its columns, then all
 * its records, or the project's files while it waits for one. A dataset the project does not hold
 * is not found.
 */
export async function loadExtractionDataset(
  queryClient: QueryClient,
  dataset: ExtractionDatasetParamsDto,
) {
  const datasets = await orNotFound(() =>
    queryClient.query({
      ...projectExtractionDatasetsQueryOptions(dataset),
      staleTime: loaderStaleTime,
    }),
  )
  const loaded = datasets.find((candidate) => candidate.id === dataset.datasetId)
  if (!loaded) throw notFound()
  await orNotFound<unknown>(() =>
    isSetUp(loaded)
      ? queryClient.query({
          ...extractionDatasetRecordsQueryOptions(dataset),
          staleTime: loaderStaleTime,
        })
      : queryClient.query({ ...extractionFilesQueryOptions(dataset), staleTime: loaderStaleTime }),
  )
}
