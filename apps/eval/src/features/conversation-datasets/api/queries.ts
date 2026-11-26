import {
  CONVERSATION_DATASET_RECORDS_PAGE_SIZE,
  type ConversationDatasetParamsDto,
  type ConversationDatasetRecordOutputDto,
  EvalConversationDatasetsRoutes,
  type ProjectParamsDto,
} from "@bayes-platform/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { conversationDatasetKeys } from "./keys"

/** The conversation datasets of a project, the last changed first. */
export const projectConversationDatasetsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: conversationDatasetKeys.ofProject(project),
    queryFn: async ({ signal }) => {
      const datasets = await apiRequest(EvalConversationDatasetsRoutes.getAll, {
        params: project,
        signal,
      })
      return datasets.sort((first, second) => second.updatedAt - first.updatedAt)
    },
  })

/**
 * All the records of a dataset, in the order they were added. The API pages them: the app reads
 * every page, one after the other, so the page shows the whole dataset.
 */
export const conversationDatasetRecordsQueryOptions = (dataset: ConversationDatasetParamsDto) =>
  queryOptions({
    queryKey: conversationDatasetKeys.records(dataset),
    queryFn: async ({ signal }) => {
      const records: ConversationDatasetRecordOutputDto[] = []
      for (let page = 0; ; page += 1) {
        const answer = await apiRequest(EvalConversationDatasetsRoutes.getRecords, {
          params: dataset,
          query: { page, limit: CONVERSATION_DATASET_RECORDS_PAGE_SIZE },
          signal,
        })
        records.push(...answer.records)
        // An empty page ends the reading too, should the total change meanwhile.
        if (records.length >= answer.total || answer.records.length === 0) return records
      }
    },
  })

/** The name of a dataset of a project, from the project's list: empty when the list lacks it. */
export const conversationDatasetNameQueryOptions = (project: ProjectParamsDto, datasetId: string) =>
  queryOptions({
    ...projectConversationDatasetsQueryOptions(project),
    select: (datasets) => datasets.find((dataset) => dataset.id === datasetId)?.name ?? "",
  })

/** A dataset of a project, from the project's list: none when the list lacks it. */
export const conversationDatasetOfProjectQueryOptions = (
  project: ProjectParamsDto,
  datasetId: string,
) =>
  queryOptions({
    ...projectConversationDatasetsQueryOptions(project),
    select: (datasets) => datasets.find((dataset) => dataset.id === datasetId) ?? null,
  })
