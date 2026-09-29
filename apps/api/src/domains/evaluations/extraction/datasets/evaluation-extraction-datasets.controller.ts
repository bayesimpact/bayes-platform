import {
  type EvaluationExtractionDatasetDto,
  type EvaluationExtractionDatasetFileColumnDto,
  type EvaluationExtractionDatasetFileDto,
  type EvaluationExtractionDatasetRecordRowDto,
  EvaluationExtractionDatasetsRoutes,
  type MimeTypes,
  type PaginatedEvaluationExtractionDatasetRecordsDto,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationExtractionDataset,
  EndpointRequestWithEvaluationExtractionDatasetDocument,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_READ_PERMISSION,
  EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { EvaluationExtractionDataset } from "./evaluation-extraction-dataset.entity"
import type { EvaluationExtractionDatasetDocument } from "./evaluation-extraction-dataset-document.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import {
  EvaluationExtractionDatasetFileColumn,
  EvaluationExtractionDatasetsService,
} from "./evaluation-extraction-datasets.service"
import type { EvaluationExtractionDatasetRecord } from "./records/evaluation-extraction-dataset-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationExtractionDatasetsController {
  constructor(
    private readonly evaluationExtractionDatasetsService: EvaluationExtractionDatasetsService,
  ) {}

  // FILES

  @Get(EvaluationExtractionDatasetsRoutes.getAllFiles.path)
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, "project")
  async getAllFiles(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getAllFiles.response> {
    const files = await this.evaluationExtractionDatasetsService.listFiles({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: files.map(toEvaluationExtractionDatasetFileDto) }
  }

  @Post(EvaluationExtractionDatasetsRoutes.presignFile.path)
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, "project")
  @HttpCode(HttpStatus.CREATED)
  async presignFile(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationExtractionDatasetsRoutes.presignFile.request,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.presignFile.response> {
    const { document, uploadUrl } = await this.evaluationExtractionDatasetsService.presignFile({
      connectScope: getRequiredConnectScope(request),
      file: { fileName: payload.fileName, mimeType: payload.mimeType, size: payload.size },
    })
    return { data: { documentId: document.id, uploadUrl } }
  }

  @Post(EvaluationExtractionDatasetsRoutes.confirmFile.path)
  @AddContext("evaluationExtractionDatasetDocument")
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionDatasetDocument.create" })
  @HttpCode(HttpStatus.CREATED)
  async confirmFile(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.confirmFile.response> {
    const document = await this.evaluationExtractionDatasetsService.confirmFile({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: toEvaluationExtractionDatasetFileDto(document) }
  }

  @Get(EvaluationExtractionDatasetsRoutes.getFileColumns.path)
  @AddContext("evaluationExtractionDatasetDocument")
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, "project")
  async getColumns(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.getFileColumns.response> {
    const columns = await this.evaluationExtractionDatasetsService.getFileColumns({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: columns.map(toEvaluationExtractionDatasetFileColumnDto) }
  }

  @Delete(EvaluationExtractionDatasetsRoutes.deleteFile.path)
  @AddContext("evaluationExtractionDatasetDocument")
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION, "project")
  @TrackActivity({
    action: "evaluationExtractionDatasetDocument.delete",
    entityFrom: "evaluationExtractionDatasetDocument",
  })
  async deleteFile(
    @Req() request: EndpointRequestWithEvaluationExtractionDatasetDocument,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.deleteFile.response> {
    await this.evaluationExtractionDatasetsService.deleteFile({
      connectScope: getRequiredConnectScope(request),
      documentId: request.evaluationExtractionDatasetDocument.id,
    })
    return { data: { success: true } }
  }

  // DATASETS

  @Get(EvaluationExtractionDatasetsRoutes.getAll.path)
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, "project")
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
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_READ_PERMISSION, "project")
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

  @Post(EvaluationExtractionDatasetsRoutes.createOne.path)
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_CREATE_PERMISSION, "project")
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

  /** Initializes a dataset from an uploaded file: name, column mapping and records. */
  @Patch(EvaluationExtractionDatasetsRoutes.updateOne.path)
  @AddContext("evaluationExtractionDataset", "evaluationExtractionDatasetDocument")
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionDataset.update" })
  async updateOne(
    @Req()
    request: EndpointRequestWithEvaluationExtractionDataset &
      EndpointRequestWithEvaluationExtractionDatasetDocument,
    @Body()
    { payload: { name, columns } }: typeof EvaluationExtractionDatasetsRoutes.updateOne.request,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.updateOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const datasetId = request.evaluationExtractionDataset.id
    const documentId = request.evaluationExtractionDatasetDocument.id

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
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_UPDATE_PERMISSION, "project")
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

  @Delete(EvaluationExtractionDatasetsRoutes.deleteOne.path)
  @AddContext("evaluationExtractionDataset")
  @CheckPermission(EVALUATION_EXTRACTION_DATASET_DELETE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionDataset.delete" })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationExtractionDataset,
  ): Promise<typeof EvaluationExtractionDatasetsRoutes.deleteOne.response> {
    await this.evaluationExtractionDatasetsService.deleteDataset({
      connectScope: getRequiredConnectScope(request),
      datasetId: request.evaluationExtractionDataset.id,
    })
    return { data: { success: true } }
  }
}

function toEvaluationExtractionDatasetFileDto(
  entity: EvaluationExtractionDatasetDocument,
): EvaluationExtractionDatasetFileDto {
  return {
    createdAt: entity.createdAt.getTime(),
    fileName: entity.fileName,
    id: entity.id,
    mimeType: entity.mimeType as MimeTypes,
    projectId: entity.projectId,
    size: entity.size,
    storageRelativePath: entity.storageRelativePath,
    updatedAt: entity.updatedAt.getTime(),
  }
}
function toEvaluationExtractionDatasetFileColumnDto(
  column: EvaluationExtractionDatasetFileColumn,
): EvaluationExtractionDatasetFileColumnDto {
  return {
    id: column.id,
    name: column.name,
    values: column.values.map((value) =>
      typeof value === "string" ? value : JSON.stringify(value),
    ),
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
    documentId: entity.evaluationExtractionDatasetDocumentId,
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
