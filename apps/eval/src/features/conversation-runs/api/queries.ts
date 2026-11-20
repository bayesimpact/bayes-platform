import {
  CONVERSATION_RUN_RECORDS_PAGE_SIZE,
  type ConversationRunOutputDto,
  type ConversationRunParamsDto,
  type ConversationRunRecordOutputDto,
  EvalAgentsRoutes,
  EvalConversationRunsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { pollWhile } from "@/lib/polling"
import { ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS, isRunActive } from "@/lib/run-status"
import { conversationRunKeys } from "./keys"

/**
 * The conversation runs of a project, the newest first. While one of them is under way, the list
 * is read again every few seconds, so its status and its figures follow.
 */
export const projectConversationRunsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: conversationRunKeys.ofProject(project),
    queryFn: async ({ signal }) => {
      const runs = await apiRequest(EvalConversationRunsRoutes.getAll, { params: project, signal })
      return runs.sort((first, second) => second.createdAt - first.createdAt)
    },
    refetchInterval: pollWhile(
      (runs: ConversationRunOutputDto[] | undefined) =>
        runs?.some((run) => isRunActive(run.status)) ?? false,
      ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS,
    ),
  })

/** A run, read again every few seconds while it is under way. */
export const conversationRunQueryOptions = (run: ConversationRunParamsDto) => {
  // The plain read: its key carries the run's type, for the read of the cache below.
  const plain = queryOptions({
    queryKey: conversationRunKeys.detail(run),
    queryFn: ({ signal }) => apiRequest(EvalConversationRunsRoutes.getOne, { params: run, signal }),
  })
  return queryOptions({
    queryKey: plain.queryKey,
    queryFn: async ({ signal, client }) => {
      const read = await apiRequest(EvalConversationRunsRoutes.getOne, { params: run, signal })
      // The run just ended: its records are read one last time, with their last answers.
      const before = client.getQueryData(plain.queryKey)
      if (before && isRunActive(before.status) && !isRunActive(read.status)) {
        void client.invalidateQueries({ queryKey: conversationRunKeys.records(run) })
      }
      return read
    },
    refetchInterval: pollWhile(
      (current: ConversationRunOutputDto | undefined) =>
        current !== undefined && isRunActive(current.status),
      ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS,
    ),
  })
}

/**
 * All the records of a run. The API pages them: the app reads every page, one after the other.
 * `isActive` reads them again every few seconds, as the records of a run under way get their
 * answers and their scores.
 */
export const conversationRunRecordsQueryOptions = (
  run: ConversationRunParamsDto,
  { isActive }: { isActive: boolean } = { isActive: false },
) =>
  queryOptions({
    queryKey: conversationRunKeys.records(run),
    queryFn: async ({ signal }) => {
      const records: ConversationRunRecordOutputDto[] = []
      for (let page = 0; ; page += 1) {
        const answer = await apiRequest(EvalConversationRunsRoutes.getRecords, {
          params: run,
          query: { page, limit: CONVERSATION_RUN_RECORDS_PAGE_SIZE },
          signal,
        })
        records.push(...answer.records)
        // An empty page ends the reading too, should the total change meanwhile.
        if (records.length >= answer.total || answer.records.length === 0) return records
      }
    },
    refetchInterval: pollWhile<ConversationRunRecordOutputDto[]>(
      () => isActive,
      ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS,
    ),
  })

/** The models of a project that can judge a run, and the one a new run starts with. */
export const judgeModelsQueryOptions = (project: ProjectParamsDto) =>
  queryOptions({
    queryKey: conversationRunKeys.projectModels(project),
    queryFn: async ({ signal }) => {
      const { models, defaults } = await apiRequest(EvalAgentsRoutes.getModels, {
        params: project,
        signal,
      })
      return {
        // What the project can use, with what a person should know before they pick one.
        models: models.filter((model) => model.isAvailable),
        defaultModel: defaults.judge,
      }
    },
  })
