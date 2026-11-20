import {
  EvalExtractionDatasetsRoutes,
  EXTRACTION_DATASET_RECORDS_PAGE_SIZE,
  type ExtractionDatasetParamsDto,
  type ExtractionDatasetRecordOutputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
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
 * All the records of a dataset, in the order of its file. The API pages them: the app reads
 * every page, one after the other, so the page shows the whole dataset.
 */
export const extractionDatasetRecordsQueryOptions = (dataset: ExtractionDatasetParamsDto) =>
  queryOptions({
    queryKey: extractionDatasetKeys.records(dataset),
    queryFn: async ({ signal }) => {
      const records: ExtractionDatasetRecordOutputDto[] = []
      for (let page = 0; ; page += 1) {
        const answer = await apiRequest(EvalExtractionDatasetsRoutes.getRecords, {
          params: dataset,
          query: { page, limit: EXTRACTION_DATASET_RECORDS_PAGE_SIZE },
          signal,
        })
        records.push(...answer.records)
        // An empty page ends the reading too, should the total change meanwhile.
        if (records.length >= answer.total || answer.records.length === 0) return records
      }
    },
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
