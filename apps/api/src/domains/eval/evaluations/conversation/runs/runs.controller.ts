import { AgentModel } from "@caseai-connect/api-contracts"
import { EvalConversationRunsRoutes } from "@caseai-connect/eval-contracts"
import {
  Controller,
  Logger,
  NotFoundException,
  Req,
  UnprocessableEntityException,
} from "@nestjs/common"
import type {
  EndpointRequestWithEvaluationConversationRun,
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
import { EvaluationConversationRunStatusNotifierService } from "@/domains/evaluations/conversation/runs/evaluation-conversation-run-status-notifier.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { EvaluationConversationRunsService } from "@/domains/evaluations/conversation/runs/evaluation-conversation-runs.service"
import {
  EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION,
  EVALUATION_CONVERSATION_RUN_READ_PERMISSION,
  EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { toConversationRunDto, toConversationRunRecordDto } from "./run.mappers"

type AgentVersion = Awaited<ReturnType<AgentSettingsService["getProduction"]>>

const AGENT_MODELS: readonly string[] = Object.values(AgentModel)

/** Whether a judge model the app sent is one the API knows. */
function isAgentModel(model: string): model is AgentModel {
  return AGENT_MODELS.includes(model)
}

/**
 * The conversation runs of a project and their records. Each handler copies the one of
 * `EvaluationConversationRunsController`, with its permission, context and activity.
 * `streamRunStatus` is not copied: Evaluation does not call it.
 */
@Controller()
export class EvalConversationRunsController {
  private readonly logger = new Logger(EvalConversationRunsController.name)

  constructor(
    private readonly runsService: EvaluationConversationRunsService,
    private readonly statusNotifierService: EvaluationConversationRunStatusNotifierService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @SchemaRoute(EvalConversationRunsRoutes.getAll, {
    permission: { key: EVALUATION_CONVERSATION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project"],
  })
  async getAll(
    @Req() request: EndpointRequestWithProject,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.getAll>> {
    const runs = await this.runsService.listRuns({
      connectScope: getRequiredConnectScope(request),
    })
    return { data: runs.map(toConversationRunDto) }
  }

  @SchemaRoute(EvalConversationRunsRoutes.getOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
  })
  async getOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.getOne>> {
    return { data: toConversationRunDto(request.evaluationConversationRun) }
  }

  /** The schema refuses a page or a limit out of bounds, which the old handler clamped. */
  @SchemaRoute(EvalConversationRunsRoutes.getRecords, {
    permission: { key: EVALUATION_CONVERSATION_RUN_READ_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
  })
  async getRecords(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
    @RouteInput() { query }: SchemaRouteInput<typeof EvalConversationRunsRoutes.getRecords>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.getRecords>> {
    const { records, total } = await this.runsService.getRunRecordsPaginated({
      connectScope: getRequiredConnectScope(request),
      runId: request.evaluationConversationRun.id,
      page: query.page,
      limit: query.limit,
    })
    return {
      data: {
        records: records.map(toConversationRunRecordDto),
        total,
        page: query.page,
        limit: query.limit,
      },
    }
  }

  @SchemaRoute(EvalConversationRunsRoutes.createOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_CREATE_PERMISSION, on: "project" },
    context: ["organization", "project"],
    activity: { action: "evaluationConversationRun.create" },
  })
  async createOne(
    @Req() request: EndpointRequestWithProject,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationRunsRoutes.createOne>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.createOne>> {
    const connectScope = getRequiredConnectScope(request)
    const { judgeModel } = payload
    // A known judge model must be available to the project. An unknown one is refused with a 422
    // after the version is resolved, where the service refused it before.
    if (isAgentModel(judgeModel))
      await this.agentSettingsService.assertModelAvailable({ connectScope, model: judgeModel })
    const agentSettings = await this.resolveAgentSettings({
      connectScope,
      agentId: payload.agentId,
      agentSettingsRevision: payload.agentSettingsRevision,
    })
    if (!isAgentModel(judgeModel))
      throw new UnprocessableEntityException(`Invalid judge model: ${judgeModel}`)
    const run = await this.runsService.createRun({
      connectScope,
      fields: {
        evaluationConversationDatasetId: payload.datasetId,
        agentId: payload.agentId,
        agentSettingsId: agentSettings.id,
        judgeModel,
        judgeInstructions: payload.judgeInstructions,
      },
    })
    // The freshly created run has no relations loaded: attach the version just resolved so the
    // response exposes the pinned revision.
    run.agentSettings = agentSettings
    return { data: toConversationRunDto(run) }
  }

  /** A copy of `EvaluationConversationRunsController.resolveAgentSettings`. */
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
    // A run evaluates a saved version: a draft still changes under the run.
    if (agentSettings.isDraft) {
      throw new UnprocessableEntityException(
        `Revision ${agentSettingsRevision} is a draft and cannot be evaluated`,
      )
    }
    return agentSettings
  }

  /** The schema refuses a record limit under 1, which the old handler refused with a 422. */
  @SchemaRoute(EvalConversationRunsRoutes.executeOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
    activity: { action: "evaluationConversationRun.execute" },
  })
  async executeOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
    @RouteInput() { payload }: SchemaRouteInput<typeof EvalConversationRunsRoutes.executeOne>,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.executeOne>> {
    const { evaluationConversationRun } = request
    await this.runsService.enqueueExecuteRun({
      evaluationConversationRun,
      connectScope: getRequiredConnectScope(request),
      recordLimit: payload.recordLimit,
    })
    return { data: toConversationRunDto(evaluationConversationRun) }
  }

  @SchemaRoute(EvalConversationRunsRoutes.retryOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
    activity: { action: "evaluationConversationRun.retry" },
  })
  async retryOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.retryOne>> {
    const { evaluationConversationRun } = request
    await this.runsService.retryRun({
      evaluationConversationRun,
      connectScope: getRequiredConnectScope(request),
    })
    // As the old handler, the run as the request found it.
    return { data: toConversationRunDto(evaluationConversationRun) }
  }

  @SchemaRoute(EvalConversationRunsRoutes.cancelOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_UPDATE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
    activity: { action: "evaluationConversationRun.cancel" },
  })
  async cancelOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.cancelOne>> {
    const connectScope = getRequiredConnectScope(request)
    const evaluationConversationRunId = request.evaluationConversationRun.id

    try {
      await this.runsService.removePendingJobsForRun({ evaluationConversationRunId, connectScope })
    } catch (error) {
      // Best effort: the run is cancelled even when its pending jobs could not be removed, since
      // the processor skips the records of a cancelled run.
      this.logger.warn(
        `Failed to remove pending jobs for run ${evaluationConversationRunId}; continuing with cancel: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    const run = await this.runsService.markRunCancelled({
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

    return { data: toConversationRunDto(run) }
  }

  @SchemaRoute(EvalConversationRunsRoutes.deleteOne, {
    permission: { key: EVALUATION_CONVERSATION_RUN_DELETE_PERMISSION, on: "project" },
    context: ["organization", "project", "evaluationConversationRun"],
    activity: { action: "evaluationConversationRun.delete" },
  })
  async deleteOne(
    @Req() request: EndpointRequestWithEvaluationConversationRun,
  ): Promise<SchemaRouteResponse<typeof EvalConversationRunsRoutes.deleteOne>> {
    await this.runsService.deleteRun({
      connectScope: getRequiredConnectScope(request),
      evaluationConversationRunId: request.evaluationConversationRun.id,
    })
    return { data: { success: true } }
  }
}
