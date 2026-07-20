import {
  type EvaluationConversationDatasetDto,
  type EvaluationConversationDatasetRecordDto,
  EvaluationConversationDatasetsRoutes,
  type PaginatedEvaluationConversationDatasetRecordsDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationConversationDataset,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { EvaluationConversationDataset } from "./evaluation-conversation-dataset.entity"
import { EvaluationConversationDatasetGuard } from "./evaluation-conversation-dataset.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationDatasetsService } from "./evaluation-conversation-datasets.service"
import type { EvaluationConversationDatasetRecord } from "./records/evaluation-conversation-dataset-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, EvaluationConversationDatasetGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationConversationDatasetsController {
  constructor(
    private readonly evaluationConversationDatasetsService: EvaluationConversationDatasetsService,
  ) {}

  @Get(EvaluationConversationDatasetsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(request)
    const datasets = await this.evaluationConversationDatasetsService.listDatasets({
      connectScope,
    })
    const recordCountByDatasetId =
      await this.evaluationConversationDatasetsService.countRecordsByDatasetId({ connectScope })
    const results: EvaluationConversationDatasetDto[] = datasets.map((dataset) =>
      toEvaluationConversationDatasetDto({
        entity: dataset,
        recordCount: recordCountByDatasetId[dataset.id] ?? 0,
      }),
    )
    return { data: results }
  }

  @Get(EvaluationConversationDatasetsRoutes.getRecords.path)
  @CheckPolicy((policy) => policy.canList())
  async getRecords(
    @Req() request: EndpointRequestWithProject,
    @Param("datasetId") datasetId: string,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.getRecords.response> {
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))

    const { records, total } =
      await this.evaluationConversationDatasetsService.listDatasetRecordsPaginated({
        connectScope: getRequiredConnectScope(request),
        datasetId,
        page,
        limit,
      })

    const data: PaginatedEvaluationConversationDatasetRecordsDto = {
      records: records.map(toEvaluationConversationDatasetRecordDto),
      total,
      page,
      limit,
    }
    return { data }
  }

  @Post(EvaluationConversationDatasetsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationConversationDataset.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body()
    { payload }: typeof EvaluationConversationDatasetsRoutes.createOne.request,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.createOne.response> {
    await this.evaluationConversationDatasetsService.createDataset({
      connectScope: getRequiredConnectScope(request),
      name: payload.name,
    })

    return { data: { success: true } }
  }

  @Patch(EvaluationConversationDatasetsRoutes.renameOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationConversationDataset.rename" })
  async renameOne(
    @Req() request: EndpointRequestWithProject,
    @Body()
    { payload: { name } }: typeof EvaluationConversationDatasetsRoutes.renameOne.request,
    @Param("datasetId") datasetId: string,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.renameOne.response> {
    await this.evaluationConversationDatasetsService.renameDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId,
      name,
    })

    return { data: { success: true } }
  }

  @Delete(EvaluationConversationDatasetsRoutes.deleteOne.path)
  @AddContext("evaluationConversationDataset")
  @CheckPolicy((policy) => policy.canDelete())
  @TrackActivity({ action: "evaluationConversationDataset.delete" })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.deleteOne.response> {
    await this.evaluationConversationDatasetsService.deleteDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
    })
    return { data: { success: true } }
  }

  @Post(EvaluationConversationDatasetsRoutes.createRecord.path)
  @AddContext("evaluationConversationDataset")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationDataset.createRecord" })
  async createRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @Body()
    { payload }: typeof EvaluationConversationDatasetsRoutes.createRecord.request,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.createRecord.response> {
    await this.evaluationConversationDatasetsService.createRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      fields: { input: payload.input, expectedOutput: payload.expectedOutput },
    })

    return { data: { success: true } }
  }

  @Patch(EvaluationConversationDatasetsRoutes.updateRecord.path)
  @AddContext("evaluationConversationDataset")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationDataset.updateRecord" })
  async updateRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @Body()
    { payload }: typeof EvaluationConversationDatasetsRoutes.updateRecord.request,
    @Param("recordId") recordId: string,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.updateRecord.response> {
    await this.evaluationConversationDatasetsService.updateRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      recordId,
      fields: { input: payload.input, expectedOutput: payload.expectedOutput },
    })

    return { data: { success: true } }
  }

  @Delete(EvaluationConversationDatasetsRoutes.deleteRecord.path)
  @AddContext("evaluationConversationDataset")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationDataset.deleteRecord" })
  async deleteRecord(
    @Req() request: EndpointRequestWithEvaluationConversationDataset,
    @Param("recordId") recordId: string,
  ): Promise<typeof EvaluationConversationDatasetsRoutes.deleteRecord.response> {
    await this.evaluationConversationDatasetsService.deleteRecord({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationConversationDataset.id,
      recordId,
    })
    return { data: { success: true } }
  }
}

function toEvaluationConversationDatasetDto({
  entity,
  recordCount,
}: {
  entity: EvaluationConversationDataset
  recordCount: number
}): EvaluationConversationDatasetDto {
  return {
    createdAt: entity.createdAt.getTime(),
    id: entity.id,
    name: entity.name,
    projectId: entity.projectId,
    recordCount,
    updatedAt: entity.updatedAt.getTime(),
  }
}

function toEvaluationConversationDatasetRecordDto(
  record: EvaluationConversationDatasetRecord,
): EvaluationConversationDatasetRecordDto {
  return {
    createdAt: record.createdAt.getTime(),
    expectedOutput: record.expectedOutput,
    id: record.id,
    input: record.input,
    updatedAt: record.updatedAt.getTime(),
  }
}
