import {
  type EvaluationExtractionDatasetDto,
  type EvaluationExtractionDatasetFileColumnDto,
  type EvaluationExtractionDatasetFileDto,
  type EvaluationExtractionDatasetRecordRowDto,
  EvaluationExtractionDatasetsRoutes,
  type PaginatedEvaluationExtractionDatasetRecordsDto,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithDocument,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import type { Document } from "@/domains/documents/document.entity"
import { UserGuard } from "@/domains/users/user.guard"
import type { EvaluationExtractionDataset } from "./evaluation-extraction-dataset.entity"
import { EvaluationExtractionDatasetGuard } from "./evaluation-extraction-dataset.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  EvaluationExtractionDatasetFileColumn,
  EvaluationExtractionDatasetsService,
} from "./evaluation-extraction-datasets.service"
import type { EvaluationExtractionDatasetRecord } from "./records/evaluation-extraction-dataset-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, EvaluationExtractionDatasetGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationExtractionDatasetsController {
  constructor(
    private readonly evaluationExtractionDatasetsService: EvaluationExtractionDatasetsService,
  ) {}

  @Get(EvaluationExtractionDatasetsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getAll.response> {
    const connectScope = getRequiredConnectScope(request)
    const datasets = await this.evaluationExtractionDatasetsService.listDatasets({
      connectScope,
    })
    const results: EvaluationExtractionDatasetDto[] = []
    for (const dataset of datasets) {
      const recordCount = await this.evaluationExtractionDatasetsService.countDatasetRecords({
        connectScope,
        datasetId: dataset.id,
      })
      results.push(toEvaluationExtractionDatasetDto({ entity: dataset, recordCount }))
    }
    return { data: results }
  }

  @Get(EvaluationExtractionDatasetsRoutes.getRecords.path)
  @CheckPolicy((policy) => policy.canList())
  async getRecords(
    @Req() request: EndpointRequestWithProject,
    @Param("datasetId") datasetId: string,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("columnFilters") columnFiltersParam?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getRecords.response> {
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))
    const validSortOrder = sortOrder === "asc" || sortOrder === "desc" ? sortOrder : undefined

    let columnFilters: Record<string, string> | undefined
    if (columnFiltersParam) {
      try {
        columnFilters = JSON.parse(columnFiltersParam)
      } catch {
        columnFilters = undefined
      }
    }

    const { records, total } =
      await this.evaluationExtractionDatasetsService.listDatasetRecordsPaginated({
        connectScope: getRequiredConnectScope(request),
        datasetId,
        page,
        limit,
        columnFilters,
        sortBy: sortBy || undefined,
        sortOrder: validSortOrder,
      })

    const data: PaginatedEvaluationExtractionDatasetRecordsDto = {
      records: records.map(toEvaluationExtractionDatasetRecordRowDto),
      total,
      page,
      limit,
    }
    return { data }
  }

  @Get(EvaluationExtractionDatasetsRoutes.getAllFiles.path)
  @CheckPolicy((policy) => policy.canList())
  async getAllFiles(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getAllFiles.response> {
    const files = await this.evaluationExtractionDatasetsService.listFiles({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: files.map(toEvaluationExtractionDatasetFileDto) }
  }

  @Get(EvaluationExtractionDatasetsRoutes.getFileColumns.path)
  @AddContext("document")
  @CheckPolicy((policy) => policy.canCreate())
  async getColumns(
    @Req() request: EndpointRequestWithDocument,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getFileColumns.response> {
    const columns = await this.evaluationExtractionDatasetsService.getFileColumns({
      connectScope: getRequiredConnectScope(request),
      documentId: request.document.id,
    })
    return { data: columns.map(toEvaluationExtractionDatasetFileColumnDto) }
  }

  @Post(EvaluationExtractionDatasetsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationExtractionDataset.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body()
    { payload }: typeof EvaluationExtractionDatasetsRoutes.createOne.request,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.createOne.response> {
    await this.evaluationExtractionDatasetsService.createDataset({
      connectScope: getRequiredConnectScope(request),
      name: payload.name,
    })

    return { data: { success: true } }
  }

  @Patch(EvaluationExtractionDatasetsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @AddContext("document")
  @TrackActivity({ action: "evaluationExtractionDataset.update" })
  async updateOne(
    @Req() request: EndpointRequestWithDocument,
    @Body()
    { payload: { name, columns } }: typeof EvaluationExtractionDatasetsRoutes.updateOne.request,
    @Param("datasetId") datasetId: string, // FIXME: should be in request context
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.updateOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const documentId = request.document.id

    await this.evaluationExtractionDatasetsService.updateDataset({
      connectScope,
      datasetId,
      fields: { name, documentId, columns },
    })

    await this.evaluationExtractionDatasetsService.createDatasetRecords({
      connectScope,
      datasetId,
      documentId,
    })

    return { data: { success: true } }
  }

  @Patch(EvaluationExtractionDatasetsRoutes.renameOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationExtractionDataset.rename" })
  async renameOne(
    @Req() request: EndpointRequestWithProject,
    @Body()
    { payload: { name } }: typeof EvaluationExtractionDatasetsRoutes.renameOne.request,
    @Param("datasetId") datasetId: string,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.renameOne.response> {
    await this.evaluationExtractionDatasetsService.renameDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId,
      name,
    })

    return { data: { success: true } }
  }
}

function toEvaluationExtractionDatasetFileDto(
  document: Document,
): EvaluationExtractionDatasetFileDto {
  return {
    createdAt: document.createdAt.getTime(),
    fileName: document.fileName,
    id: document.id,
    projectId: document.projectId,
    size: document.size,
    storageRelativePath: document.storageRelativePath,
    updatedAt: document.updatedAt.getTime(),
  }
}
function toEvaluationExtractionDatasetFileColumnDto(
  v: EvaluationExtractionDatasetFileColumn,
): EvaluationExtractionDatasetFileColumnDto {
  return {
    id: v.id,
    name: v.name,
    values: v.values.map((v) => (typeof v === "string" ? v : JSON.stringify(v))),
  }
}

function toEvaluationExtractionDatasetDto({
  entity,
  recordCount,
}: {
  entity: EvaluationExtractionDataset
  recordCount: number
}): EvaluationExtractionDatasetDto {
  return {
    createdAt: entity.createdAt.getTime(),
    id: entity.id,
    name: entity.name,
    projectId: entity.projectId,
    schemaMapping: entity.schemaMapping,
    updatedAt: entity.updatedAt.getTime(),
    documentIds: entity.evaluationExtractionDatasetDocuments.map((d) => d.documentId),
    recordCount,
  }
}

function toEvaluationExtractionDatasetRecordRowDto(
  record: EvaluationExtractionDatasetRecord,
): EvaluationExtractionDatasetRecordRowDto {
  return {
    id: record.id,
    data: record.data,
  }
}
