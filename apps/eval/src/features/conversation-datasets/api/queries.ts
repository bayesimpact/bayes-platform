import {
  CONVERSATION_DATASET_RECORDS_PAGE_SIZE,
  type ConversationDatasetParamsDto,
  EvalConversationDatasetsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
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
 * A page of a dataset's records, in the order they were added: pages count from 0. The route's
 * loader reads the next page before it shows, so the page shown stays meanwhile.
 */
export const conversationDatasetRecordsQueryOptions = (
  dataset: ConversationDatasetParamsDto,
  page: number,
) =>
  queryOptions({
    queryKey: conversationDatasetKeys.recordsPage(dataset, page),
    queryFn: ({ signal }) =>
      apiRequest(EvalConversationDatasetsRoutes.getRecords, {
        params: dataset,
        query: { page, limit: CONVERSATION_DATASET_RECORDS_PAGE_SIZE },
        signal,
      }),
  })
