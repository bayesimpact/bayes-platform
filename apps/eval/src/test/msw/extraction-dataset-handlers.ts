import { EvalExtractionDatasetsRoutes } from "@caseai-connect/eval-contracts"
import { HttpResponse, http } from "msw"
import type { EvalWorld } from "../factories/eval-world.factory"
import {
  buildExtractionDataset,
  buildExtractionFile,
  fileColumnsOf,
  recordsOf,
} from "../factories/extraction-datasets.factory"
import { apiError, mockRoute } from "./mock-route"
import { pageOfRecords } from "./records-page"

/** The storage a file's bytes go to: its signed URLs start with it. */
const STORAGE_URL = "https://storage.example.org/extraction-files"

/**
 * The extraction datasets of a project, the files they are built from and their records: list,
 * upload, create, set up, rename, delete.
 */
export function extractionDatasetHandlers(world: EvalWorld) {
  const find = (datasetId: string) =>
    world.extractionDatasets.find((entry) => entry.dataset.id === datasetId)
  const findFile = (documentId: string) =>
    world.extractionFiles.find((entry) => entry.file.id === documentId)
  /** The files whose upload started, by their id, until they are confirmed. */
  const uploads = new Map<string, { projectId: string; fileName: string; size: number }>()
  return [
    mockRoute(EvalExtractionDatasetsRoutes.getAllFiles, ({ params }) =>
      world.extractionFiles
        .filter((entry) => entry.projectId === params.projectId)
        .map((entry) => entry.file),
    ),
    mockRoute(EvalExtractionDatasetsRoutes.presignFile, ({ params, payload }) => {
      const documentId = crypto.randomUUID()
      uploads.set(documentId, {
        projectId: params.projectId,
        fileName: payload.fileName,
        size: payload.size,
      })
      return { documentId, uploadUrl: `${STORAGE_URL}/${documentId}` }
    }),
    // The storage takes the bytes of a file: it is not the API, so it has no route of its own.
    http.put(`${STORAGE_URL}/:documentId`, () => new HttpResponse(null, { status: 200 })),
    mockRoute(EvalExtractionDatasetsRoutes.confirmFile, ({ params }) => {
      const upload = uploads.get(params.documentId)
      if (!upload) return apiError(404)
      uploads.delete(params.documentId)
      const entry = buildExtractionFile(upload.projectId, {
        id: params.documentId,
        fileName: upload.fileName,
        size: upload.size,
        createdAt: Date.now(),
      })
      world.extractionFiles.unshift(entry)
      return entry.file
    }),
    mockRoute(EvalExtractionDatasetsRoutes.getFileColumns, ({ params }) => {
      const entry = findFile(params.documentId)
      return entry ? fileColumnsOf(entry) : apiError(404)
    }),
    mockRoute(EvalExtractionDatasetsRoutes.deleteFile, ({ params }) => {
      const index = world.extractionFiles.findIndex((entry) => entry.file.id === params.documentId)
      if (index === -1) return apiError(404)
      world.extractionFiles.splice(index, 1)
      return { success: true }
    }),
    mockRoute(EvalExtractionDatasetsRoutes.getAll, ({ params }) =>
      world.extractionDatasets
        .filter((entry) => entry.projectId === params.projectId)
        .map((entry) => ({ ...entry.dataset, recordCount: entry.records.length })),
    ),
    mockRoute(EvalExtractionDatasetsRoutes.createOne, ({ params, payload }) => {
      world.extractionDatasets.push(
        buildExtractionDataset(params.projectId, {
          name: payload.name,
          updatedAt: Date.now(),
        }),
      )
      return { success: true }
    }),
    mockRoute(EvalExtractionDatasetsRoutes.setUpOne, ({ params, payload }) => {
      const entry = find(params.datasetId)
      const file = findFile(params.documentId)
      if (!entry || !file) return apiError(404)
      entry.dataset.name = payload.name
      entry.dataset.schemaMapping = Object.fromEntries(
        payload.columns.map((column) => [column.id, column]),
      )
      entry.dataset.updatedAt = Date.now()
      entry.records = recordsOf(file)
      return { success: true }
    }),
    mockRoute(EvalExtractionDatasetsRoutes.renameOne, ({ params, payload }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      entry.dataset.name = payload.name
      entry.dataset.updatedAt = Date.now()
      return { success: true }
    }),
    mockRoute(EvalExtractionDatasetsRoutes.deleteOne, ({ params }) => {
      const index = world.extractionDatasets.findIndex(
        (entry) => entry.dataset.id === params.datasetId,
      )
      if (index === -1) return apiError(404)
      world.extractionDatasets.splice(index, 1)
      return { success: true }
    }),
    mockRoute(EvalExtractionDatasetsRoutes.getRecords, ({ params, query }) => {
      const entry = find(params.datasetId)
      if (!entry) return apiError(404)
      return pageOfRecords(entry.records, query, (record, columnId) =>
        String(record.data[columnId] ?? ""),
      )
    }),
  ]
}
