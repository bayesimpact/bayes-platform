import {
  CONVERSATION_RUN_RECORDS_PAGE_SIZE,
  type ConversationRunParamsDto,
  EvalAgentsRoutes,
  EvalConversationRunsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS, isRunActive } from "../run-status"
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
    refetchInterval: (query) =>
      query.state.data?.some((run) => isRunActive(run.status))
        ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS
        : false,
  })

/** A run, read again every few seconds while it is under way. */
export const conversationRunQueryOptions = (run: ConversationRunParamsDto) =>
  queryOptions({
    queryKey: conversationRunKeys.detail(run),
    queryFn: ({ signal }) => apiRequest(EvalConversationRunsRoutes.getOne, { params: run, signal }),
    refetchInterval: (query) =>
      query.state.data && isRunActive(query.state.data.status)
        ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS
        : false,
  })

/**
 * A page of a run's records: pages count from 0. `isActive` reads it again every few seconds, as
 * the records of a run under way get their answers and their scores.
 */
export const conversationRunRecordsQueryOptions = (
  run: ConversationRunParamsDto,
  page: number,
  { isActive }: { isActive: boolean } = { isActive: false },
) =>
  queryOptions({
    queryKey: conversationRunKeys.recordsPage(run, page),
    queryFn: ({ signal }) =>
      apiRequest(EvalConversationRunsRoutes.getRecords, {
        params: run,
        query: { page, limit: CONVERSATION_RUN_RECORDS_PAGE_SIZE },
        signal,
      }),
    refetchInterval: isActive ? ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS : false,
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
        models: models.filter((model) => model.isAvailable).map((model) => model.model),
        defaultModel: defaults.judge,
      }
    },
  })
