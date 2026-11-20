import {
  type ConversationDatasetNameInputDto,
  type ConversationDatasetParamsDto,
  type ConversationDatasetRecordInputDto,
  EvalConversationDatasetsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { type QueryClient, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { CONVERSATION_RUNS_QUERY_KEY } from "@/lib/run-query-keys"
import { conversationDatasetKeys } from "./keys"

/** A dataset's records changed: they load again, and the list, which counts them. */
const invalidateRecords = (queryClient: QueryClient, dataset: ConversationDatasetParamsDto) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: conversationDatasetKeys.records(dataset) }),
    queryClient.invalidateQueries({ queryKey: conversationDatasetKeys.ofProject(dataset) }),
  ])

/** Creates an empty dataset, then loads the project's list again. */
export function useCreateConversationDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ConversationDatasetNameInputDto) =>
      apiRequest(EvalConversationDatasetsRoutes.createOne, { params: project, body }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationDatasetKeys.ofProject(project) }),
  })
}

/** Renames a dataset, then loads the project's list again. */
export function useRenameConversationDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ datasetId, name }: { datasetId: string; name: string }) =>
      apiRequest(EvalConversationDatasetsRoutes.renameOne, {
        params: { ...project, datasetId },
        body: { name },
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationDatasetKeys.ofProject(project) }),
  })
}

/**
 * Deletes a dataset with its records: its own queries go, so a step back does not show it. The
 * API deletes its runs with it, so the runs load again too.
 */
export function useDeleteConversationDataset(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datasetId: string) =>
      apiRequest(EvalConversationDatasetsRoutes.deleteOne, { params: { ...project, datasetId } }),
    onSuccess: (_answer, datasetId) =>
      queryClient.removeQueries({
        queryKey: conversationDatasetKeys.records({ ...project, datasetId }),
      }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: conversationDatasetKeys.ofProject(project) }),
        queryClient.invalidateQueries({ queryKey: CONVERSATION_RUNS_QUERY_KEY }),
      ]),
  })
}

/** Adds a record to a dataset. */
export function useCreateConversationDatasetRecord(dataset: ConversationDatasetParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: ConversationDatasetRecordInputDto) =>
      apiRequest(EvalConversationDatasetsRoutes.createRecord, { params: dataset, body }),
    onSettled: () => invalidateRecords(queryClient, dataset),
  })
}

/** Adds several records to a dataset at once. */
export function useCreateConversationDatasetRecords(dataset: ConversationDatasetParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (records: ConversationDatasetRecordInputDto[]) =>
      apiRequest(EvalConversationDatasetsRoutes.createRecords, {
        params: dataset,
        body: { records },
      }),
    onSettled: () => invalidateRecords(queryClient, dataset),
  })
}

/** Changes a record of a dataset. */
export function useUpdateConversationDatasetRecord(dataset: ConversationDatasetParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ recordId, ...body }: ConversationDatasetRecordInputDto & { recordId: string }) =>
      apiRequest(EvalConversationDatasetsRoutes.updateRecord, {
        params: { ...dataset, recordId },
        body,
      }),
    onSettled: () => invalidateRecords(queryClient, dataset),
  })
}

/** Deletes a record of a dataset. */
export function useDeleteConversationDatasetRecord(dataset: ConversationDatasetParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (recordId: string) =>
      apiRequest(EvalConversationDatasetsRoutes.deleteRecord, {
        params: { ...dataset, recordId },
      }),
    onSettled: () => invalidateRecords(queryClient, dataset),
  })
}
