import {
  type EvaluationExtractionRunDto,
  type EvaluationExtractionRunRecordDto,
  type EvaluationExtractionRunStatusChangedEventDto,
  EvaluationExtractionRunsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Inject, Post, Query, Req, Sse, UseGuards } from "@nestjs/common"
import type { Observable } from "rxjs"
import { filter, map } from "rxjs/operators"
import type {
  EndpointRequestWithEvaluationExtractionRun,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import type { EvaluationExtractionRun } from "./evaluation-extraction-run.entity"
import { EvaluationExtractionRunGuard } from "./evaluation-extraction-run.guard"
import type { EvaluationExtractionRunBatchService } from "./evaluation-extraction-run-batch.interface"
import { EVALUATION_EXTRACTION_RUN_BATCH_SERVICE } from "./evaluation-extraction-run-batch.interface"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusNotifierService } from "./evaluation-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusStreamService } from "./evaluation-extraction-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunsService } from "./evaluation-extraction-runs.service"
import type { EvaluationExtractionRunRecord } from "./records/evaluation-extraction-run-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, EvaluationExtractionRunGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationExtractionRunsController {
  constructor(
    private readonly evaluationExtractionRunsService: EvaluationExtractionRunsService,
    @Inject(EVALUATION_EXTRACTION_RUN_BATCH_SERVICE)
    private readonly batchService: EvaluationExtractionRunBatchService,
    private readonly runStatusStreamService: EvaluationExtractionRunStatusStreamService,
    private readonly statusNotifierService: EvaluationExtractionRunStatusNotifierService,
  ) {}

  @Post(EvaluationExtractionRunsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationExtractionRun.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationExtractionRunsRoutes.createOne.request,
  ): Promise<typeof EvaluationExtractionRunsRoutes.createOne.response> {
    const run = await this.evaluationExtractionRunsService.createRun({
      connectScope: getRequiredConnectScope(request),
      fields: {
        evaluationExtractionDatasetId: payload.evaluationExtractionDatasetId,
        agentId: payload.agentId,
        keyMapping: payload.keyMapping,
      },
    })
    return { data: toEvaluationExtractionRunDto(run) }
  }

  @Post(EvaluationExtractionRunsRoutes.executeOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationExtractionRun.execute" })
  async executeOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.executeOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const run = request.evaluationExtractionRun

    await this.batchService.enqueueExecuteRun({
      runId: run.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })

    return { data: toEvaluationExtractionRunDto(run) }
  }

  @Post(EvaluationExtractionRunsRoutes.retryOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationExtractionRun.retry" })
  async retryOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.retryOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const run = request.evaluationExtractionRun

    await this.batchService.retryExecuteRun({
      runId: run.id,
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })

    return { data: toEvaluationExtractionRunDto(run) }
  }

  @Post(EvaluationExtractionRunsRoutes.cancelOne.path)
  @AddContext("evaluationExtractionRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationExtractionRun.cancel" })
  async cancelOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.cancelOne.response> {
    const run = await this.evaluationExtractionRunsService.markRunCancelled({
      run: request.evaluationExtractionRun,
    })

    await this.batchService.removePendingJob(run.id)

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
  @CheckPolicy((policy) => policy.canList())
  async getOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<typeof EvaluationExtractionRunsRoutes.getOne.response> {
    return { data: toEvaluationExtractionRunDto(request.evaluationExtractionRun) }
  }

  @Get(EvaluationExtractionRunsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
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
  @CheckPolicy((policy) => policy.canList())
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

  @CheckPolicy((policy) => policy.canList())
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
    traceUrl: record.traceId ? getTraceUrl(record.traceId) : null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }
}
