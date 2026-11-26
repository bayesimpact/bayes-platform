import { EvalExtractionRunsRoutes } from "@bayes-platform/eval-contracts"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { createQueryClient } from "@/app/query-client"
import { buildExtractionRun } from "@/test/factories/extraction-runs.factory"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { useStartExtractionRun } from "./mutations"

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ isRetrying: false })}>
    {children}
  </QueryClientProvider>
)

describe("useStartExtractionRun", () => {
  it("deletes the run it created when the run cannot start, and fails", async () => {
    const project = { organizationId: crypto.randomUUID(), projectId: crypto.randomUUID() }
    const agentId = crypto.randomUUID()
    const datasetId = crypto.randomUUID()
    const { run } = buildExtractionRun(project.projectId, {
      agentId,
      evaluationExtractionDatasetId: datasetId,
      status: "pending",
    })
    const deletedRunIds: string[] = []
    server.use(
      mockRoute(EvalExtractionRunsRoutes.createOne, () => run),
      mockRoute(EvalExtractionRunsRoutes.executeOne, () => apiError(500)),
      mockRoute(EvalExtractionRunsRoutes.deleteOne, ({ params }) => {
        deletedRunIds.push(params.evaluationExtractionRunId)
        return { success: true }
      }),
    )
    const { result } = renderHook(() => useStartExtractionRun(project), { wrapper })

    act(() =>
      result.current.mutate({
        agentId,
        agentSettingsRevision: null,
        evaluationExtractionDatasetId: datasetId,
        keyMapping: run.keyMapping,
        recordLimit: null,
      }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(deletedRunIds).toEqual([run.id])
  })
})
