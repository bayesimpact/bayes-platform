import { EvalAgentsRoutes, EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import {
  buildAgentModels,
  buildAgentVersions,
  buildConversationRun,
  buildConversationRunRecord,
} from "../factories/conversation-runs.factory"
import type { EvalWorld } from "../factories/eval-world.factory"
import { apiError, mockRoute } from "./mock-route"

/** The conversation runs of a project and what a new one picks from: versions and models. */
export function conversationRunHandlers(world: EvalWorld) {
  const find = (runId: string) => world.conversationRuns.find((entry) => entry.run.id === runId)
  const setStatus = (runId: string, status: "running" | "cancelled") => {
    const entry = find(runId)
    if (!entry) return apiError(404)
    entry.run.status = status
    entry.run.updatedAt = Date.now()
    return entry.run
  }
  return [
    mockRoute(EvalAgentsRoutes.getVersions, () => buildAgentVersions()),
    mockRoute(EvalAgentsRoutes.getModels, () => buildAgentModels()),
    mockRoute(EvalConversationRunsRoutes.getAll, ({ params }) =>
      world.conversationRuns
        .filter((entry) => entry.projectId === params.projectId)
        .map((entry) => entry.run),
    ),
    mockRoute(
      EvalConversationRunsRoutes.getOne,
      ({ params }) => find(params.evaluationConversationRunId)?.run ?? apiError(404),
    ),
    mockRoute(EvalConversationRunsRoutes.getRecords, ({ params, query }) => {
      const entry = find(params.evaluationConversationRunId)
      if (!entry) return apiError(404)
      const start = query.page * query.limit
      return {
        records: entry.records.slice(start, start + query.limit),
        total: entry.records.length,
        page: query.page,
        limit: query.limit,
      }
    }),
    mockRoute(EvalConversationRunsRoutes.createOne, ({ params, payload }) => {
      const dataset = world.conversationDatasets.find(
        (entry) => entry.dataset.id === payload.datasetId,
      )
      if (!dataset) return apiError(404)
      const created = buildConversationRun(
        params.projectId,
        {
          agentId: payload.agentId,
          evaluationConversationDatasetId: payload.datasetId,
          status: "pending",
          judgeModel: payload.judgeModel,
          judgeInstructions: payload.judgeInstructions,
          summary: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        dataset.records.map((record) =>
          buildConversationRunRecord({
            status: "running",
            input: record.input,
            expectedOutput: record.expectedOutput,
            output: null,
            score: null,
          }),
        ),
      )
      world.conversationRuns.unshift(created)
      return created.run
    }),
    mockRoute(EvalConversationRunsRoutes.executeOne, ({ params }) =>
      setStatus(params.evaluationConversationRunId, "running"),
    ),
    mockRoute(EvalConversationRunsRoutes.retryOne, ({ params }) =>
      setStatus(params.evaluationConversationRunId, "running"),
    ),
    mockRoute(EvalConversationRunsRoutes.cancelOne, ({ params }) =>
      setStatus(params.evaluationConversationRunId, "cancelled"),
    ),
    mockRoute(EvalConversationRunsRoutes.deleteOne, ({ params }) => {
      const index = world.conversationRuns.findIndex(
        (entry) => entry.run.id === params.evaluationConversationRunId,
      )
      if (index === -1) return apiError(404)
      world.conversationRuns.splice(index, 1)
      return { success: true }
    }),
  ]
}
