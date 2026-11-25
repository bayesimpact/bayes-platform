import { EvalConversationDatasetsRoutes } from "@caseai-connect/eval-contracts"
import { Controller, Req } from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationConversationDataset,
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
import { EvaluationConversationDatasetsService } from "@/domains/evaluations/conversation/datasets/evaluation-conversation-datasets.service"
import {
  EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_READ_PERMISSION,
  EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { toConversationDatasetDto, toConversationDatasetRecordDto } from "./dataset.mappers"

/**
 * The conversation datasets of a project and their records. `EvaluationConversationDatasetsController`
 * still serves the list to the Studio, with the Studio's fields: a change to one list goes to the
 * other.
 */
@Controller()
export class EvalConversationDatasetsController {
  constructor(private readonly datasetsService: EvaluationConversationDatasetsService) {}

  @SchemaRoute(EvalConversationDatasetsRoutes.getAll, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.getAll>> {
    const connectScope = getRequiredConnectScope(request)
    const datasets = await this.datasetsService.listDatasets({ connectScope })
    const recordCountByDatasetId = await this.datasetsService.countRecordsByDatasetId({
      connectScope,
    })
    return {
      data: datasets.map((dataset) =>
        toConversationDatasetDto({
          dataset,
          recordCount: recordCountByDatasetId[dataset.id] ?? 0,
        }),
      ),
    }
  }

  /** The schema refuses a page or a limit out of bounds, which the old handler clamped. */
  @SchemaRoute(EvalConversationDatasetsRoutes.getRecords, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getRecords(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() {
      params,
      query,
    }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.getRecords>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.getRecords>> {
    const { records, total } = await this.datasetsService.listDatasetRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      datasetId: params.datasetId,
      page: query.page,
      limit: query.limit,
    })
    return {
      data: {
        records: records.map(toConversationDatasetRecordDto),
        total,
        page: query.page,
        limit: query.limit,
      },
    }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.createOne, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationConversationDataset.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.createOne>> {
    await this.datasetsService.createDataset({
      connectScope: getRequiredConnectScope(request),
      name: payload.name,
    })
    return { data: { success: true } }
  }

  /** No dataset context, as today: the service answers 404 for a dataset of another project. */
  @SchemaRoute(EvalConversationDatasetsRoutes.renameOne, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationConversationDataset.rename" },
  })
  async renameOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() {
      params,
      payload,
    }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.renameOne>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.renameOne>> {
    await this.datasetsService.renameDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: params.datasetId,
      name: payload.name,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.deleteOne, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationDataset"],
    activity: { action: "evaluationConversationDataset.delete" },
  })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.deleteOne>> {
    await this.datasetsService.deleteDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.createRecord, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationDataset"],
    activity: { action: "evaluationConversationDataset.createRecord" },
  })
  async createRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.createRecord>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.createRecord>> {
    await this.datasetsService.createRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      fields: { input: payload.input, expectedOutput: payload.expectedOutput },
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.createRecords, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationDataset"],
    activity: { action: "evaluationConversationDataset.createRecords" },
  })
  async createRecords(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @RouteInput() {
      payload,
    }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.createRecords>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.createRecords>> {
    await this.datasetsService.createRecords({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      records: payload.records,
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.updateRecord, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationDataset"],
    activity: { action: "evaluationConversationDataset.updateRecord" },
  })
  async updateRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @RouteInput() {
      params,
      payload,
    }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.updateRecord>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.updateRecord>> {
    await this.datasetsService.updateRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      recordId: params.recordId,
      fields: { input: payload.input, expectedOutput: payload.expectedOutput },
    })
    return { data: { success: true } }
  }

  @SchemaRoute(EvalConversationDatasetsRoutes.deleteRecord, {
    permission: { key: EVALUATION_CONVERSATION_DATASET_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationDataset"],
    activity: { action: "evaluationConversationDataset.deleteRecord" },
  })
  async deleteRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @RouteInput() { params }: SchemaRouteInput<typeof EvalConversationDatasetsRoutes.deleteRecord>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationDatasetsRoutes.deleteRecord>> {
    await this.datasetsService.deleteRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      recordId: params.recordId,
    })
    return { data: { success: true } }
  }
}
