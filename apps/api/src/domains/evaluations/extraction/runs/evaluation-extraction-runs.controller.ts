import {
  type EvaluationExtractionRunDto,
  type EvaluationExtractionRunRecordDto,
  type EvaluationExtractionRunStatusChangedEventDto,
  EvaluationExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Sse,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs/operators"
import type {
  EndpointRequestWithEvaluationExtractionRun,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/llm/trace-url"
import type { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunCsvExportService } from "./evaluation-extraction-run-csv-export.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusStreamService } from "./evaluation-extraction-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunsService } from "./evaluation-extraction-runs.service"
import type { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationExtractionRunsController {
  private readonly logger = new Logger(EvaluationExtractionRunsController.name)

  constructor(
    private readonly evaluationExtractionRunsService: EvaluationExtractionRunsService,
    private readonly csvExportService: EvaluationExtractionRunCsvExportService,
    private readonly runStatusStreamService: EvaluationExtractionRunStatusStreamService,
    private readonly statusNotifierService: EvaluationExtractionRunStatusNotifierService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @Post(EvaluationExtractionRunsRoutes.createOne.path)
  @CheckPermission(EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionRun.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationExtractionRunsRoutes.createOne.request,
  ): Promise<typeof EvaluationExtractionRunsRoutes.createOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentSettings = await this.resolveAgentSettings({
      connectScope,
      agentId: payload.agentId,
      agentSettingsRevision: payload.agentSettingsRevision,
    })
    const run = await this.evaluationExtractionRunsService.createRun({
      connectScope,
      fields: {
        evaluationExtractionDatasetId: payload.evaluationExtractionDatasetId,
        agentId: payload.agentId,
        agentSettingsId: agentSettings.id,
        keyMapping: payload.keyMapping,
      },
    })
    // The freshly created run has no relations loaded; attach the settings we
    // just resolved so the response exposes the pinned revision.
    run.agentSettings = agentSettings
    return { data: toEvaluationExtractionRunDto(run) }
  }

  private async resolveAgentSettings({
    connectScope,
    agentId,
    agentSettingsRevision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettingsRevision: number | null | undefined
  }) {
    if (typeof agentSettingsRevision !== "number") {
      return this.agentSettingsService.getLast({ connectScope, agentId })
    }
    if (
      !(
        Number.isInteger(agentSettingsRevision) &&
        agentSettingsRevision > 0 &&
        // Postgres int4 upper bound: a larger value would error at query time.
        agentSettingsRevision <= 2147483647
      )
    ) {
      throw new UnprocessableEntityException("Settings version must be a positive integer")
    }
    const agentSettings = await this.agentSettingsService.get({
      connectScope,
      agentId,
      revision: agentSettingsRevision,
    })
    if (!agentSettings) {
      throw new NotFoundException(
        `Revision ${agentSettingsRevision} not found for agent with id ${agentId}`,
      )
    }
    if (agentSettings.isArchived) {
      throw new UnprocessableEntityException(
        `Revision ${agentSettingsRevision} is archived and cannot be run`,
      )
    }
    return agentSettings
  }

  @Post(EvaluationExtractionRunsRoutes.executeOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionRun.execute" })
  async executeOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
    @Body() { payload }: typeof EvaluationExtractionRunsRoutes.executeOne.request,
  ): Promise<typeof EvaluationExtractionRunsRoutes.executeOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { evaluationExtractionRun } = request

    await this.evaluationExtractionRunsService.enqueueExecuteRun({
      evaluationExtractionRun,
      connectScope,
      recordLimit: payload?.recordLimit ?? null,
    })

    return { data: toEvaluationExtractionRunDto(evaluationExtractionRun) }
  }

  @Post(EvaluationExtractionRunsRoutes.retryOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionRun.retry" })
  async retryOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.retryOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { evaluationExtractionRun } = request

    await this.evaluationExtractionRunsService.retryRun({ evaluationExtractionRun, connectScope })

    return { data: toEvaluationExtractionRunDto(evaluationExtractionRun) }
  }

  @Post(EvaluationExtractionRunsRoutes.cancelOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionRun.cancel" })
  async cancelOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.cancelOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const evaluationExtractionRunId = request.evaluationExtractionRun.id

    this.evaluationExtractionRunsService.removePendingJobsForRun({
      evaluationExtractionRunId,
      connectScope,
    })

    const run = await this.evaluationExtractionRunsService.markRunCancelled({
      evaluationExtractionRun: request.evaluationExtractionRun,
      connectScope,
    })

    try {
      await this.csvExportService.generateAndStoreDocument(run)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for cancelled run ${run.id}: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }

    await this.statusNotifierService.notifyRunStatusChanged({
      evaluationExtractionRunId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      status: run.status,
      summary: run.summary,
      updatedAt: run.updatedAt.getTime(),
    })

    return { data: toEvaluationExtractionRunDto(run) }
  }

  @Get(EvaluationExtractionRunsRoutes.getOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.getOne.response> {
    return { data: toEvaluationExtractionRunDto(request.evaluationExtractionRun) }
  }

  @Get(EvaluationExtractionRunsRoutes.getAll.path)
  @CheckPermission(EVALUATION_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationExtractionRunsRoutes.getAll.response> {
    const runs = await this.evaluationExtractionRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: runs.map(toEvaluationExtractionRunDto) }
  }

  @Get(EvaluationExtractionRunsRoutes.getRecords.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_READ_PERMISSION, "project")
  async getRecords(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
    @Query("columnFilters") columnFiltersParam?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: string,
  ): Promise<typeof EvaluationExtractionRunsRoutes.getRecords.response> {
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

    const { records, total } = await this.evaluationExtractionRunsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: request.evaluationExtractionRun.id,
      page,
      limit,
      columnFilters,
      sortBy: sortBy || undefined,
      sortOrder: validSortOrder,
    })

    return {
      data: {
        records: records.map(toEvaluationExtractionRunRecordDto),
        total,
        page,
        limit,
      },
    }
  }

  @Delete(EvaluationExtractionRunsRoutes.deleteOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPermission(EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION, "project")
  @TrackActivity({ action: "evaluationExtractionRun.delete" })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.deleteOne.response> {
    await this.evaluationExtractionRunsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      evaluationExtractionRunId: request.evaluationExtractionRun.id,
    })
    return { data: { success: true } }
  }

  @CheckPermission(EVALUATION_EXTRACTION_RUN_READ_PERMISSION, "project")
  @Sse(EvaluationExtractionRunsRoutes.streamRunStatus.path, { method: 0 /* GET */ })
  streamRunStatus(
    @Req() request: EndpointRequestWithProject,
  ): Observable<EvaluationExtractionRunStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(request)
    return this.runStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }
}

function toEvaluationExtractionRunDto(run: EvaluationExtractionRun): EvaluationExtractionRunDto {
  return {
    id: run.id,
    evaluationExtractionDatasetId: run.evaluationExtractionDatasetId,
    agentId: run.agentId,
    agentSettingsId: run.agentSettingsId,
    agentRevision: run.agentSettings.revision,
    keyMapping: run.keyMapping,
    status: run.status,
    summary: run.summary,
    csvExportDocumentId: run.csvExportDocumentId,
    projectId: run.projectId,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

function toEvaluationExtractionRunRecordDto(
  record: EvaluationExtractionRunRecord,
): EvaluationExtractionRunRecordDto {
  return {
    id: record.id,
    evaluationExtractionRunId: record.evaluationExtractionRunId,
    evaluationExtractionDatasetRecordId: record.evaluationExtractionDatasetRecordId,
    status: record.status,
    comparison: record.comparison,
    agentRawOutput: record.agentRawOutput,
    errorDetails: record.errorDetails,
    datasetRecordData: record.evaluationExtractionDatasetRecord?.data ?? null,
    traceUrl: record.traceId ? (getTraceUrl(record.traceId) ?? null) : null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }
}
