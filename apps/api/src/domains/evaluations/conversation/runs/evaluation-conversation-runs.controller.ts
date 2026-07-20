import {
  type EvaluationConversationRunDto,
  type EvaluationConversationRunRecordDto,
  type EvaluationConversationRunStatusChangedEventDto,
  EvaluationConversationRunsRoutes,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
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
  EndpointRequestWithEvaluationConversationRun,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { getTraceUrl } from "@/external/langfuse/langfuse-helper"
import type { EvaluationConversationRun } from "./evaluation-conversation-run.entity"
import { EvaluationConversationRunGuard } from "./evaluation-conversation-run.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunStatusNotifierService } from "./evaluation-conversation-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunStatusStreamService } from "./evaluation-conversation-run-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunsService } from "./evaluation-conversation-runs.service"
import type { EvaluationConversationRunRecord } from "./records/evaluation-conversation-run-record.entity"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, EvaluationConversationRunGuard)
@RequireContext("organization", "project")
@Controller()
export class EvaluationConversationRunsController {
  private readonly logger = new Logger(EvaluationConversationRunsController.name)

  constructor(
    private readonly evaluationConversationRunsService: EvaluationConversationRunsService,
    private readonly runStatusStreamService: EvaluationConversationRunStatusStreamService,
    private readonly statusNotifierService: EvaluationConversationRunStatusNotifierService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @Post(EvaluationConversationRunsRoutes.createOne.path)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "evaluationConversationRun.create" })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @Body() { payload }: typeof EvaluationConversationRunsRoutes.createOne.request,
  ): Promise<typeof EvaluationConversationRunsRoutes.createOne.response> {
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope: getRequiredConnectScope(request),
      agentId: payload.agentId,
    })
    const run = await this.evaluationConversationRunsService.createRun({
      connectScope: getRequiredConnectScope(request),
      fields: {
        evaluationConversationDatasetId: payload.datasetId,
        agentId: payload.agentId,
        agentSettingsId: agentSettings.id,
      },
    })
    return { data: toEvaluationConversationRunDto(run) }
  }

  @Post(EvaluationConversationRunsRoutes.executeOne.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationRun.execute" })
  async executeOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
    @Body() { payload }: typeof EvaluationConversationRunsRoutes.executeOne.request,
  ): Promise<typeof EvaluationConversationRunsRoutes.executeOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { evaluationConversationRun } = request

    const recordLimit = payload?.recordLimit ?? null
    if (recordLimit != null && recordLimit <= 0) {
      throw new UnprocessableEntityException("recordLimit must be a positive number")
    }

    await this.evaluationConversationRunsService.enqueueExecuteRun({
      evaluationConversationRun,
      connectScope,
      recordLimit,
    })

    return { data: toEvaluationConversationRunDto(evaluationConversationRun) }
  }

  @Post(EvaluationConversationRunsRoutes.retryOne.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationRun.retry" })
  async retryOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<typeof EvaluationConversationRunsRoutes.retryOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const { evaluationConversationRun } = request

    await this.evaluationConversationRunsService.retryRun({
      evaluationConversationRun,
      connectScope,
    })

    return { data: toEvaluationConversationRunDto(evaluationConversationRun) }
  }

  @Post(EvaluationConversationRunsRoutes.cancelOne.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canUpdate())
  @TrackActivity({ action: "evaluationConversationRun.cancel" })
  async cancelOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<typeof EvaluationConversationRunsRoutes.cancelOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const evaluationConversationRunId = request.evaluationConversationRun.id

    try {
      await this.evaluationConversationRunsService.removePendingJobsForRun({
        evaluationConversationRunId,
        connectScope,
      })
    } catch (error) {
      // Best-effort: still cancel the run even if pending jobs could not be removed
      // (the processor skips records of a cancelled run anyway).
      this.logger.warn(
        `Failed to remove pending jobs for run ${evaluationConversationRunId}; continuing with cancel: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const run = await this.evaluationConversationRunsService.markRunCancelled({
      evaluationConversationRun: request.evaluationConversationRun,
      connectScope,
    })

    await this.statusNotifierService.notifyRunStatusChanged({
      evaluationConversationRunId: run.id,
      organizationId: run.organizationId,
      projectId: run.projectId,
      status: run.status,
      summary: run.summary,
      updatedAt: run.updatedAt.getTime(),
    })

    return { data: toEvaluationConversationRunDto(run) }
  }

  @Get(EvaluationConversationRunsRoutes.getOne.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canList())
  async getOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<typeof EvaluationConversationRunsRoutes.getOne.response> {
    return { data: toEvaluationConversationRunDto(request.evaluationConversationRun) }
  }

  @Get(EvaluationConversationRunsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<typeof EvaluationConversationRunsRoutes.getAll.response> {
    const runs = await this.evaluationConversationRunsService.listRuns({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: runs.map(toEvaluationConversationRunDto) }
  }

  @Get(EvaluationConversationRunsRoutes.getRecords.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canList())
  async getRecords(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
    @Query("page") pageParam?: string,
    @Query("limit") limitParam?: string,
  ): Promise<typeof EvaluationConversationRunsRoutes.getRecords.response> {
    const page = Math.max(0, Number(pageParam) || 0)
    const limit = Math.min(100, Math.max(1, Number(limitParam) || 10))

    const { records, total } = await this.evaluationConversationRunsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: request.evaluationConversationRun.id,
      page,
      limit,
    })

    return {
      data: {
        records: records.map(toEvaluationConversationRunRecordDto),
        total,
        page,
        limit,
      },
    }
  }

  @Delete(EvaluationConversationRunsRoutes.deleteOne.path)
  @AddContext("evaluationConversationRun")
  @CheckPolicy((policy) => policy.canDelete())
  @TrackActivity({ action: "evaluationConversationRun.delete" })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<typeof EvaluationConversationRunsRoutes.deleteOne.response> {
    await this.evaluationConversationRunsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      evaluationConversationRunId: request.evaluationConversationRun.id,
    })
    return { data: { success: true } }
  }

  @CheckPolicy((policy) => policy.canList())
  @Sse(EvaluationConversationRunsRoutes.streamRunStatus.path, { method: 0 /* GET */ })
  streamRunStatus(
    @Req() request: EndpointRequestWithProject,
  ): Observable<EvaluationConversationRunStatusChangedEventDto> {
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

function toEvaluationConversationRunDto(
  run: EvaluationConversationRun,
): EvaluationConversationRunDto {
  return {
    id: run.id,
    evaluationConversationDatasetId: run.evaluationConversationDatasetId,
    agentId: run.agentId,
    status: run.status,
    summary: run.summary,
    projectId: run.projectId,
    createdAt: run.createdAt.getTime(),
    updatedAt: run.updatedAt.getTime(),
  }
}

function toEvaluationConversationRunRecordDto(
  record: EvaluationConversationRunRecord,
): EvaluationConversationRunRecordDto {
  return {
    id: record.id,
    evaluationConversationRunId: record.evaluationConversationRunId,
    evaluationConversationDatasetRecordId: record.evaluationConversationDatasetRecordId,
    status: record.status,
    input: record.input,
    expectedOutput: record.expectedOutput,
    output: record.output,
    score: record.score,
    errorDetails: record.errorDetails,
    traceUrl: record.traceId ? getTraceUrl(record.traceId) : null,
    createdAt: record.createdAt.getTime(),
    updatedAt: record.updatedAt.getTime(),
  }
}
