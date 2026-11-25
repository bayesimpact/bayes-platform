import { EvalExtractionDatasetsRoutes } from "@bayes-platform/eval-contracts"
import { Controller, HttpStatus, Req } from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationExtractionDataset,
  EndpointRequestWithEvaluationExtractionDatasetDocument,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionDatasetsService } from "@/domains/evaluations/extraction/datasets/evaluation-extraction-datasets.service"
import {
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import {
  toExtractionDatasetDto,
  toExtractionDatasetFileColumnDto,
  toExtractionDatasetFileDto,
  toExtractionDatasetRecordDto,
} from "./dataset.mappers"

/**
 * The extraction datasets of a project, the CSV files they are built from and their records.
 */
@Controller()
export class EvalExtractionDatasetsController {
  constructor(private readonly datasetsService: EvaluationExtractionDatasetsService) {}

  @SchemaRoute(EvalExtractionDatasetsRoutes.getAllFiles, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAllFiles(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.getAllFiles>> {
    const files = await this.datasetsService.listFiles({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: files.map(toExtractionDatasetFileDto) }
  }

  /** The schema refuses a file that is not a CSV, which the service refused with a 422. */
  @SchemaRoute(EvalExtractionDatasetsRoutes.presignFile, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    status: HttpStatus.CREATED,
  })
  async presignFile(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalExtractionDatasetsRoutes.presignFile>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.presignFile>> {
    const { document, uploadUrl } = await this.datasetsService.presignFile({
      connectScope: getRequiredConnectScope(request),
      file: { fileName: payload.fileName, mimeType: payload.mimeType, size: payload.size },
    })
    return { data: { documentId: document.id, uploadUrl } }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.confirmFile, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionDatasetDocument"],
    activity: { action: "evaluationExtractionDatasetDocument.create" },
    status: HttpStatus.CREATED,
  })
  async confirmFile(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.confirmFile>> {
    const document = await this.datasetsService.confirmFile({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: toExtractionDatasetFileDto(document) }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.getFileColumns, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionDatasetDocument"],
  })
  async getFileColumns(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.getFileColumns>> {
    const columns = await this.datasetsService.getFileColumns({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: columns.map(toExtractionDatasetFileColumnDto) }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.deleteFile, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionDatasetDocument"],
    activity: {
      action: "evaluationExtractionDatasetDocument.delete",
      entityFrom: "evaluationExtractionDatasetDocument",
    },
  })
  async deleteFile(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.deleteFile>> {
    await this.datasetsService.deleteFile({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.getAll, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.getAll>> {
    const connectScope = getRequiredConnectScope(request)
    const datasets = await this.datasetsService.listDatasets({ connectScope })
    const data: SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.getAll>["data"] = []
    for (const dataset of datasets) {
      const recordCount = await this.datasetsService.countDatasetRecords({
        connectScope,
        datasetId: dataset.id,
      })
      data.push(toExtractionDatasetDto({ dataset, recordCount }))
    }
    return { data }
  }

  /**
   * The schema refuses a page or a limit out of bounds, which the old handler clamped, and
   * `columnFilters` that is not JSON, which it ignored.
   */
  @SchemaRoute(EvalExtractionDatasetsRoutes.getRecords, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getRecords(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() {
      params,
      query,
    }: SchemaRouteInput<typeof EvalExtractionDatasetsRoutes.getRecords>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.getRecords>> {
    const { records, total } = await this.datasetsService.listDatasetRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      datasetId: params.datasetId,
      page: query.page,
      limit: query.limit,
      columnFilters: query.columnFilters,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder,
    })
    return {
      data: {
        records: records.map(toExtractionDatasetRecordDto),
        total,
        page: query.page,
        limit: query.limit,
      },
    }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.createOne, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationExtractionDataset.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalExtractionDatasetsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.createOne>> {
    await this.datasetsService.createDataset({
      connectScope: getRequiredConnectScope(request),
      name: payload.name,
    })
    return { data: { success: true } }
  }

  /** Builds a dataset from an uploaded file: name, column mapping and records. */
  @SchemaRoute(EvalExtractionDatasetsRoutes.setUpOne, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: [
      "organization",
      "project",
      "evaluationExtractionDataset",
      "evaluationExtractionDatasetDocument",
    ],
    activity: { action: "evaluationExtractionDataset.update" },
  })
  async setUpOne(
    @Req()
    request: EndpointRequestWithEvaluationExtractionDataset &
      EndpointRequestWithEvaluationExtractionDatasetDocument,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalExtractionDatasetsRoutes.setUpOne>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.setUpOne>> {
    const connectScope = getRequiredConnectScope(request)
    const datasetId = request.evaluationExtractionDataset.id
    const documentId = request.evaluationExtractionDatasetDocument.id

    await this.datasetsService.updateDataset({
      connectScope,
      datasetId,
      fields: { name: payload.name, documentId, columns: payload.columns },
    })
    await this.datasetsService.createDatasetRecords({ connectScope, datasetId, documentId })
    return { data: { success: true } }
  }

  /** No dataset context, as today: the service answers 404 for a dataset of another project. */
  @SchemaRoute(EvalExtractionDatasetsRoutes.renameOne, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationExtractionDataset.rename" },
  })
  async renameOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() {
      params,
      payload,
    }: SchemaRouteInput<typeof EvalExtractionDatasetsRoutes.renameOne>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.renameOne>> {
    await this.datasetsService.renameDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: params.datasetId,
      name: payload.name,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalExtractionDatasetsRoutes.deleteOne, {
    permission: { key: EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionDataset"],
    activity: { action: "evaluationExtractionDataset.delete" },
  })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationExtractionDataset,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionDatasetsRoutes.deleteOne>> {
    await this.datasetsService.deleteDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationExtractionDataset.id,
    })
    return { data: { success: true } }
  }
}
