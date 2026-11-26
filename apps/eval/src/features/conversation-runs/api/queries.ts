import {
  CONVERSATION_RUN_RECORDS_PAGE_SIZE,
  type ConversationRunOutputDto,
  type ConversationRunParamsDto,
  type ConversationRunRecordOutputDto,
  EvalAgentsRoutes,
  EvalConversationRunsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { pollWhile } from "@caseai-connect/frontend-lib"
import { queryOptions } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
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

/** A page of the records of a run, counted from 0. */
const readRecordsPage = (run: ConversationRunParamsDto, page: number, signal: AbortSignal) =>
  apiRequest(EvalConversationRunsRoutes.getRecords, {
    params: run,
    query: { page, limit: CONVERSATION_RUN_RECORDS_PAGE_SIZE },
    signal,
  })

/** Every record of a run: the first page says how many there are, and the others come at once. */
async function readAllRecords(
  run: ConversationRunParamsDto,
  signal: AbortSignal,
): Promise<ConversationRunRecordOutputDto[]> {
  const first = await readRecordsPage(run, 0, signal)
  const pageCount = Math.ceil(first.total / CONVERSATION_RUN_RECORDS_PAGE_SIZE)
  const others = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_unused, index) =>
      readRecordsPage(run, index + 1, signal),
    ),
  )
  return [first, ...others].flatMap((answer) => answer.records)
}

/**
 * The records of a run read before, with the pages that held a record still waiting read again:
 * the others no longer change. None when nothing waits, or when the records moved meanwhile,
 * which every record then reads again.
 */
async function readWaitingRecords(
  run: ConversationRunParamsDto,
  previous: ConversationRunRecordOutputDto[],
  signal: AbortSignal,
): Promise<ConversationRunRecordOutputDto[] | null> {
  const pages = [
    ...new Set(
      previous.flatMap((record, index) =>
        record.status === "running" ? [Math.floor(index / CONVERSATION_RUN_RECORDS_PAGE_SIZE)] : [],
      ),
    ),
  ]
  if (pages.length === 0) return null
  const answers = await Promise.all(
    pages.map(async (page) => ({ page, answer: await readRecordsPage(run, page, signal) })),
  )
  const records = [...previous]
  for (const { page, answer } of answers) {
    const start = page * CONVERSATION_RUN_RECORDS_PAGE_SIZE
    const isSamePlace = answer.records.every(
      (record, index) => previous[start + index]?.id === record.id,
    )
    if (answer.total !== previous.length || !isSamePlace) return null
    records.splice(start, answer.records.length, ...answer.records)
  }
  return records
}

/**
 * All the records of a run. The API pages them: the app reads every page. `isActive` reads them
 * again every few seconds, as the records of a run under way get their answers and their scores:
 * only the pages that hold a record still waiting, as the others no longer change.
 */
export const conversationRunRecordsQueryOptions = (
  run: ConversationRunParamsDto,
  { isActive }: { isActive: boolean } = { isActive: false },
) => {
  // The plain read: its key carries the records' type, for the read of the cache below.
  const plain = queryOptions({
    queryKey: conversationRunKeys.records(run),
    queryFn: ({ signal }) => readAllRecords(run, signal),
  })
  return queryOptions({
    queryKey: plain.queryKey,
    queryFn: async ({ signal, client }) => {
      const previous = client.getQueryData(plain.queryKey)
      return (
        (previous && (await readWaitingRecords(run, previous, signal))) ??
        readAllRecords(run, signal)
      )
    },
    refetchInterval: pollWhile<ConversationRunRecordOutputDto[]>(
      () => isActive,
      ACTIVE_RUN_REFETCH_INTERVAL_IN_MILLISECONDS,
    ),
  })
}

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
