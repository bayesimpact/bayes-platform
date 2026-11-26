import { EvalExtractionRunsRoutes } from "@bayes-platform/eval-contracts"
import {
  Controller,
  Logger,
  NotFoundException,
  Req,
  UnprocessableEntityException,
} from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationExtractionRun,
  EndpointRequestWithProject,
} from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "@/domains/agents/settings/agent-settings.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunCsvExportService } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run-csv-export.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunStatusNotifierService } from "@/domains/evaluations/extraction/runs/evaluation-extraction-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationExtractionRunsService } from "@/domains/evaluations/extraction/runs/evaluation-extraction-runs.service"
import {
  EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION,
  EVALUATION_EXTRACTION_RUN_READ_PERMISSION,
  EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { toExtractionRunDto, toExtractionRunRecordDto } from "./run.mappers"

type AgentVersion = Awaited<ReturnType<AgentSettingsService["getProduction"]>>

/** The largest revision Postgres stores in an `int4`: a larger value would error at query time. */
const MAX_REVISION = 2147483647

/**
 * The extraction runs of a project and their records. No route streams the status of the runs:
 * Evaluation polls.
 */
@Controller()
export class EvalExtractionRunsController {
  private readonly logger = new Logger(EvalExtractionRunsController.name)

  constructor(
    private readonly runsService: EvaluationExtractionRunsService,
    private readonly csvExportService: EvaluationExtractionRunCsvExportService,
    private readonly statusNotifierService: EvaluationExtractionRunStatusNotifierService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @SchemaRoute(EvalExtractionRunsRoutes.getAll, {
    permission: { key: EVALUATION_EXTRACTION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.getAll>> {
    const runs = await this.runsService.listRuns({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: runs.map(toExtractionRunDto) }
  }

  @SchemaRoute(EvalExtractionRunsRoutes.getOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
  })
  async getOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.getOne>> {
    return { data: toExtractionRunDto(request.evaluationExtractionRun) }
  }

  /**
   * The schema refuses a page or a limit out of bounds, which the old handler clamped, and
   * `columnFilters` that is not JSON, which it ignored.
   */
  @SchemaRoute(EvalExtractionRunsRoutes.getRecords, {
    permission: { key: EVALUATION_EXTRACTION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
  })
  async getRecords(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
    @RouteInput() { query }: SchemaRouteInput<typeof EvalExtractionRunsRoutes.getRecords>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.getRecords>> {
    const { records, total } = await this.runsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: request.evaluationExtractionRun.id,
      page: query.page,
      limit: query.limit,
      columnFilters: query.columnFilters,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder,
    })
    return {
      data: {
        records: records.map(toExtractionRunRecordDto),
        total,
        page: query.page,
        limit: query.limit,
      },
    }
  }

  @SchemaRoute(EvalExtractionRunsRoutes.createOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationExtractionRun.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalExtractionRunsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.createOne>> {
    const connectScope = getRequiredConnectScope(request)
    const agentSettings = await this.resolveAgentSettings({
      connectScope,
      agentId: payload.agentId,
      agentSettingsRevision: payload.agentSettingsRevision,
    })
    const run = await this.runsService.createRun({
      connectScope,
      fields: {
        evaluationExtractionDatasetId: payload.evaluationExtractionDatasetId,
        agentId: payload.agentId,
        agentSettingsId: agentSettings.id,
        keyMapping: payload.keyMapping,
      },
    })
    // The freshly created run has no relations loaded: attach the version just resolved so the
    // response exposes the pinned revision.
    run.agentSettings = agentSettings
    return { data: toExtractionRunDto(run) }
  }

  /**
   * The version a run pins: the requested one, or the one in production. The schema takes any
   * whole number as a revision: the range stays a check of the handler.
   */
  private async resolveAgentSettings({
    connectScope,
    agentId,
    agentSettingsRevision,
  }: {
    connectScope: RequiredConnectScope
    agentId: string
    agentSettingsRevision: number | null
  }): Promise<AgentVersion> {
    if (agentSettingsRevision === null) {
      return this.agentSettingsService.getProduction({ connectScope, agentId })
    }
    if (agentSettingsRevision < 1 || agentSettingsRevision > MAX_REVISION) {
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
    // A run evaluates a saved version: a draft still changes under the run.
    if (agentSettings.isDraft) {
      throw new UnprocessableEntityException(
        `Revision ${agentSettingsRevision} is a draft and cannot be evaluated`,
      )
    }
    return agentSettings
  }

  /** The schema refuses a record limit under 1 and a body without `recordLimit`. */
  @SchemaRoute(EvalExtractionRunsRoutes.executeOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
    activity: { action: "evaluationExtractionRun.execute" },
  })
  async executeOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalExtractionRunsRoutes.executeOne>,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.executeOne>> {
    const { evaluationExtractionRun } = request
    await this.runsService.enqueueExecuteRun({
      evaluationExtractionRun,
      connectScope: getRequiredConnectScope(request),
      recordLimit: payload.recordLimit,
    })
    return { data: toExtractionRunDto(evaluationExtractionRun) }
  }

  @SchemaRoute(EvalExtractionRunsRoutes.retryOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
    activity: { action: "evaluationExtractionRun.retry" },
  })
  async retryOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.retryOne>> {
    const { evaluationExtractionRun } = request
    await this.runsService.retryRun({
      evaluationExtractionRun,
      connectScope: getRequiredConnectScope(request),
    })
    // As the old handler, the run as the request found it.
    return { data: toExtractionRunDto(evaluationExtractionRun) }
  }

  @SchemaRoute(EvalExtractionRunsRoutes.cancelOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
    activity: { action: "evaluationExtractionRun.cancel" },
  })
  async cancelOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.cancelOne>> {
    const connectScope = getRequiredConnectScope(request)
    const evaluationExtractionRunId = request.evaluationExtractionRun.id

    // As the old handler, the removal is not awaited. A failure is logged: the run is cancelled
    // all the same, and the processor skips the records of a cancelled run.
    this.runsService
      .removePendingJobsForRun({ evaluationExtractionRunId, connectScope })
      .catch((error: unknown) => {
        this.logger.warn(
          `Failed to remove pending jobs for run ${evaluationExtractionRunId}: ${error instanceof Error ? error.message : String(error)}`,
        )
      })

    const run = await this.runsService.markRunCancelled({
      evaluationExtractionRun: request.evaluationExtractionRun,
      connectScope,
    })

    try {
      await this.csvExportService.generateAndStoreDocument(run)
    } catch (error) {
      this.logger.error(
        `Failed to generate CSV export for cancelled run ${run.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
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

    return { data: toExtractionRunDto(run) }
  }

  @SchemaRoute(EvalExtractionRunsRoutes.deleteOne, {
    permission: { key: EVALUATION_EXTRACTION_RUN_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationExtractionRun"],
    activity: { action: "evaluationExtractionRun.delete" },
  })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationExtractionRun,
  ): Promise<SchemaRouteResponse<typeof EvalExtractionRunsRoutes.deleteOne>> {
    await this.runsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      evaluationExtractionRunId: request.evaluationExtractionRun.id,
    })
    return { data: { success: true } }
  }
}
