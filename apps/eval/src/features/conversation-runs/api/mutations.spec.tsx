import { EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { createQueryClient } from "@/app/query-client"
import { buildConversationRun } from "@/test/factories/conversation-runs.factory"
import { apiError, mockRoute } from "@/test/msw/mock-route"
import { server } from "@/test/msw/server"
import { useStartConversationRun } from "./mutations"

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ isRetrying: false })}>
    {children}
  </QueryClientProvider>
)

describe("useStartConversationRun", () => {
  it("deletes the run it created when the run cannot start, and fails", async () => {
    const project = { organizationId: crypto.randomUUID(), projectId: crypto.randomUUID() }
    const agentId = crypto.randomUUID()
    const datasetId = crypto.randomUUID()
    const { run } = buildConversationRun(project.projectId, {
      agentId,
      evaluationConversationDatasetId: datasetId,
      status: "pending",
    })
    const deletedRunIds: string[] = []
    server.use(
      mockRoute(EvalConversationRunsRoutes.createOne, () => run),
      mockRoute(EvalConversationRunsRoutes.executeOne, () => apiError(500)),
      mockRoute(EvalConversationRunsRoutes.deleteOne, ({ params }) => {
        deletedRunIds.push(params.evaluationConversationRunId)
        return { success: true }
      }),
    )
    const { result } = renderHook(() => useStartConversationRun(project), { wrapper })

    act(() =>
      result.current.mutate({
        agentId,
        agentSettingsRevision: null,
        datasetId,
        judgeModel: "model-large",
        judgeInstructions: null,
        recordLimit: null,
      }),
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(deletedRunIds).toEqual([run.id])
  })
})
