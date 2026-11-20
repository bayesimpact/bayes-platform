import {
  EvalDocumentsRoutes,
  EvalExtractionRunsRoutes,
  type ExtractionRunInputDto,
  type ProjectParamsDto,
} from "@caseai-connect/eval-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "@/lib/api-client"
import { openInTab } from "@/lib/safe-url"
import { extractionRunKeys } from "./keys"
import { extractionRunQueryOptions } from "./queries"

/** What starts a run: what creates it, and how many records it asks, `null` for all of them. */
export type StartExtractionRunInput = ExtractionRunInputDto & { recordLimit: number | null }

/** Creates a run, then starts it: the API does each in its own call. */
export function useStartExtractionRun(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ recordLimit, ...body }: StartExtractionRunInput) => {
      const run = await apiRequest(EvalExtractionRunsRoutes.createOne, { params: project, body })
      return apiRequest(EvalExtractionRunsRoutes.executeOne, {
        params: { ...project, evaluationExtractionRunId: run.id },
        body: { recordLimit },
      })
    },
    // The run the API answers: its page, which opens next, reads it from the cache.
    onSuccess: (run) =>
      queryClient.setQueryData(
        extractionRunQueryOptions({ ...project, evaluationExtractionRunId: run.id }).queryKey,
        run,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionRunKeys.ofProject(project) }),
  })
}

/** A run changed: itself, its records and the project's list load again. */
function useRunChange(
  project: ProjectParamsDto,
  route: typeof EvalExtractionRunsRoutes.cancelOne | typeof EvalExtractionRunsRoutes.retryOne,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (evaluationExtractionRunId: string) =>
      apiRequest(route, { params: { ...project, evaluationExtractionRunId } }),
    // The run as the API answers it shows at once; its records and the list load again after.
    onSuccess: (run, evaluationExtractionRunId) =>
      queryClient.setQueryData(
        extractionRunQueryOptions({ ...project, evaluationExtractionRunId }).queryKey,
        run,
      ),
    onSettled: (_run, _error, evaluationExtractionRunId) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: extractionRunKeys.ofRun({ ...project, evaluationExtractionRunId }),
        }),
        queryClient.invalidateQueries({ queryKey: extractionRunKeys.ofProject(project) }),
      ]),
  })
}

/** Stops a run that waits or is under way. */
export const useCancelExtractionRun = (project: ProjectParamsDto) =>
  useRunChange(project, EvalExtractionRunsRoutes.cancelOne)

/** Asks again the records of a run that failed. */
export const useRetryExtractionRun = (project: ProjectParamsDto) =>
  useRunChange(project, EvalExtractionRunsRoutes.retryOne)

/** Deletes a run with its records: its own queries go, so a step back does not show it. */
export function useDeleteExtractionRun(project: ProjectParamsDto) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (evaluationExtractionRunId: string) =>
      apiRequest(EvalExtractionRunsRoutes.deleteOne, {
        params: { ...project, evaluationExtractionRunId },
      }),
    onSuccess: (_answer, evaluationExtractionRunId) =>
      queryClient.removeQueries({
        queryKey: extractionRunKeys.ofRun({ ...project, evaluationExtractionRunId }),
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: extractionRunKeys.ofProject(project) }),
  })
}

/**
 * Opens the results of a run as a CSV file, in a new tab. The tab opens at once, while the click
 * still counts as the person's, and goes to the file once its short-lived URL arrives.
 */
export function useOpenRunCsv(project: ProjectParamsDto) {
  return useMutation({
    mutationFn: ({ documentId, tab }: { documentId: string; tab: Window | null }) =>
      openInTab(tab, async () => {
        const { url } = await apiRequest(EvalDocumentsRoutes.getTemporaryUrl, {
          params: { ...project, documentId },
        })
        return url
      }),
  })
}
