import {
  type ConversationRunInputDto,
  EvalConversationRunsRoutes,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { conversationRunKeys } from "./keys"
import { conversationRunQueryOptions } from "./queries"

/** What starts a run: what creates it, and how many records it asks, `null` for all of them. */
export type StartConversationRunInput = ConversationRunInputDto & { recordLimit: number | null }

/**
 * Creates a run, then starts it: the API does each in its own call. A run that could not start
 * is deleted, so it does not wait for ever among the runs, and another try makes no second one.
 */
export function useStartConversationRun(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ recordLimit, ...body }: StartConversationRunInput) => {
      const run = await apiRequest(EvalConversationRunsRoutes.createOne, { params: project, body })
      const params = { ...project, evaluationConversationRunId: run.id }
      try {
        return await apiRequest(EvalConversationRunsRoutes.executeOne, {
          params,
          body: { recordLimit },
        })
      } catch (error) {
        // The start's error is the one the person sees; a run the deletion leaves shows as waiting.
        await apiRequest(EvalConversationRunsRoutes.deleteOne, { params }).catch(() => undefined)
        throw error
      }
    },
    // The run the API answers: its page, which opens next, reads it from the cache.
    onSuccess: (run) =>
      queryClient.setQueryData(
        conversationRunQueryOptions({ ...project, evaluationConversationRunId: run.id }).queryKey,
        run,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationRunKeys.ofProject(project) }),
  })
}

/** A run changed: itself, its records and the project's list load again. */
function useRunChange(
  project: ProjectParamsDto,
  route: typeof EvalConversationRunsRoutes.cancelOne | typeof EvalConversationRunsRoutes.retryOne,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (evaluationConversationRunId: string) =>
      apiRequest(route, { params: { ...project, evaluationConversationRunId } }),
    // The run as the API answers it shows at once; its records and the list load again after.
    onSuccess: (run, evaluationConversationRunId) =>
      queryClient.setQueryData(
        conversationRunQueryOptions({ ...project, evaluationConversationRunId }).queryKey,
        run,
      ),
    onSettled: (_run, _error, evaluationConversationRunId) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: conversationRunKeys.ofRun({ ...project, evaluationConversationRunId }),
        }),
        queryClient.invalidateQueries({ queryKey: conversationRunKeys.ofProject(project) }),
      ]),
  })
}

/** Stops a run that waits or is under way. */
export const useCancelConversationRun = (project: ProjectParamsDto) =>
  useRunChange(project, EvalConversationRunsRoutes.cancelOne)

/** Asks again the records of a run that failed. */
export const useRetryConversationRun = (project: ProjectParamsDto) =>
  useRunChange(project, EvalConversationRunsRoutes.retryOne)

/** Deletes a run with its records: its own queries go, so a step back does not show it. */
export function useDeleteConversationRun(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (evaluationConversationRunId: string) =>
      apiRequest(EvalConversationRunsRoutes.deleteOne, {
        params: { ...project, evaluationConversationRunId },
      }),
    onSuccess: (_answer, evaluationConversationRunId) =>
      queryClient.removeQueries({
        queryKey: conversationRunKeys.ofRun({ ...project, evaluationConversationRunId }),
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: conversationRunKeys.ofProject(project) }),
  })
}
