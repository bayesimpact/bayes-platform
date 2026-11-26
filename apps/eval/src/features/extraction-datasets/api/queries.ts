import {
  EvalExtractionDatasetsRoutes,
  EXTRACTION_DATASET_RECORDS_PAGE_SIZE,
  type ExtractionDatasetParamsDto,
  type ProjectParamsDto,
} from "@bayes-platform/eval-contracts"
import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { type RecordsSearch, recordsQueryOf } from "@/lib/records-search"
import { extractionDatasetKeys } from "./keys"

/** The extraction datasets of a project, the last changed first. */
export const projectExtractionDatasetsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: extractionDatasetKeys.ofProject(project),
    queryFn: async ({ signal }) => {
      const datasets = await apiRequest(EvalExtractionDatasetsRoutes.getAll, {
        params: project,
        signal,
      })
      return datasets.sort((first, second) => second.updatedAt - first.updatedAt)
    },
  })

/** A dataset of a project, from the project's list: none when the list lacks it. */
export const extractionDatasetOfProjectQueryOptions = (
  project: ProjectParamsDto,
  datasetId: string,
) =>
  queryOptions({
    ...projectExtractionDatasetsQueryOptions(project),
    select: (datasets) => datasets.find((dataset) => dataset.id === datasetId) ?? null,
  })

/**
 * A page of the records of a dataset, narrowed and sorted by the API: a dataset may hold
 * thousands of them. Another page, order or search keeps the rows shown until its own arrive.
 */
export const extractionDatasetRecordsQueryOptions = (
  dataset: ExtractionDatasetParamsDto,
  search: RecordsSearch,
) =>
  queryOptions({
    queryKey: extractionDatasetKeys.recordsPage(dataset, search),
    queryFn: ({ signal }) =>
      apiRequest(EvalExtractionDatasetsRoutes.getRecords, {
        params: dataset,
        query: recordsQueryOf(search, EXTRACTION_DATASET_RECORDS_PAGE_SIZE),
        signal,
      }),
    placeholderData: keepPreviousData,
  })

/** The CSV files of a project, the last uploaded first. */
export const extractionFilesQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: extractionDatasetKeys.files(project),
    queryFn: async ({ signal }) => {
      const files = await apiRequest(EvalExtractionDatasetsRoutes.getAllFiles, {
        params: project,
        signal,
      })
      return files.sort((first, second) => second.createdAt - first.createdAt)
    },
  })

/** The columns of a file, each with its first values. */
export const extractionFileColumnsQueryOptions = (project: ProjectParamsDto, documentId: string) =>
  queryOptions({
    queryKey: extractionDatasetKeys.fileColumns(project, documentId),
    queryFn: ({ signal }) =>
      apiRequest(EvalExtractionDatasetsRoutes.getFileColumns, {
        params: { ...project, documentId },
        signal,
      }),
  })
