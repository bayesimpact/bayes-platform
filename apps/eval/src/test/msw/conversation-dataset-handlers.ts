import { EvalConversationDatasetsRoutes } from "@bayes-platform/eval-contracts"
import {
  buildConversationDataset,
  buildConversationDatasetRecord,
} from "../factories/conversation-datasets.factory"
import type { EvalWorld } from "../factories/eval-world.factory"
import { apiError, mockRoute } from "./mock-route"

/** The conversation datasets of a project and their records: list, create, change, delete. */
export function conversationDatasetHandlers(world: EvalWorld) {
  const find = (datasetId: string) =>
    world.conversationDatasets.find((entry) => entry.dataset.id === datasetId)
  const touch = (datasetId: string) => {
    const entry = find(datasetId)
    if (entry) entry.dataset.updatedAt = Date.now()
  }
  return [
    mockRoute(EvalConversationDatasetsRoutes.getAll, ({ params }) =>
      world.conversationDatasets
        .filter((entry) => entry.projectId === params.projectId)
        .map((entry) => ({ ...entry.dataset, recordCount: entry.records.length })),
    ),
    mockRoute(EvalConversationDatasetsRoutes.createOne, ({ params, payload }) => {
      world.conversationDatasets.push(
        buildConversationDataset(params.projectId, {
          name: payload.name,
          updatedAt: Date.now(),
        }),
      )
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.renameOne, ({ params, payload }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      entry.dataset.name = payload.name
      touch(params.datasetId)
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.deleteOne, ({ params }) => {
      const index = world.conversationDatasets.findIndex(
        (entry) => entry.dataset.id === params.datasetId,
      )
      if (index === -1) return apiError(404)
      world.conversationDatasets.splice(index, 1)
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.getRecords, ({ params, query }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      const start = query.page * query.limit
      return {
        records: entry.records.slice(start, start + query.limit),
        total: entry.records.length,
        page: query.page,
        limit: query.limit,
      }
    }),
    mockRoute(EvalConversationDatasetsRoutes.createRecord, ({ params, payload }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      entry.records.push(buildConversationDatasetRecord(payload))
      touch(params.datasetId)
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.createRecords, ({ params, payload }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      entry.records.push(...payload.records.map((record) => buildConversationDatasetRecord(record)))
      touch(params.datasetId)
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.updateRecord, ({ params, payload }) => {
      const record = find(params.datasetId)?.records.find(
        (candidate) => candidate.id === params.recordId,
      )
      if (!record) return apiError(404)
      Object.assign(record, payload)
      touch(params.datasetId)
      return { success: true }
    }),
    mockRoute(EvalConversationDatasetsRoutes.deleteRecord, ({ params }) => {
      const entry = find(params.datasetId)
      const index = entry?.records.findIndex((candidate) => candidate.id === params.recordId) ?? -1
      if (!entry || index === -1) return apiError(404)
      entry.records.splice(index, 1)
      touch(params.datasetId)
      return { success: true }
    }),
  ]
}
