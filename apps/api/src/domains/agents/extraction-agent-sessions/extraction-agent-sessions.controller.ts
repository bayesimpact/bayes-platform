import {
  type ExtractionAgentSessionDto,
  type ExtractionAgentSessionStatusChangedEventDto,
  type ExtractionAgentSessionSummaryDto,
  ExtractionAgentSessionsRoutes,
} from "@caseai-connect/api-contracts"
import { Body, Controller, Post, Req, Sse, UseGuards } from "@nestjs/common"
import { filter, map, type Observable } from "rxjs"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
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
import { BaseAgentSessionGuard } from "../base-agent-sessions/base-agent-session.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { BaseAgentSessionsService } from "../base-agent-sessions/base-agent-sessions.service"
import type { BaseAgentSessionType } from "../base-agent-sessions/base-agent-sessions.types"
import type { ExtractionAgentSession } from "./extraction-agent-session.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionStatusStreamService } from "./extraction-agent-session-status-stream.service"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ExtractionAgentSessionsService } from "./extraction-agent-sessions.service"

// BaseAgentSessionGuard is applied per-method rather than at class level because
// the SSE stream endpoint is a bodyless GET and does not carry payload.type.
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class ExtractionAgentSessionsController {
  constructor(
    private readonly extractionAgentSessionsService: ExtractionAgentSessionsService,
    private readonly baseAgentSessionsService: BaseAgentSessionsService,
    private readonly sessionStatusStreamService: ExtractionAgentSessionStatusStreamService,
    private readonly agentSettingsService: AgentSettingsService,
  ) {}

  @Post(ExtractionAgentSessionsRoutes.executeOne.path)
  @UseGuards(BaseAgentSessionGuard)
  @CheckPolicy((policy) => policy.canCreate())
  @TrackActivity({ action: "extractionAgentSession.execute" })
  async executeOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof ExtractionAgentSessionsRoutes.executeOne.request,
  ): Promise<typeof ExtractionAgentSessionsRoutes.executeOne.response> {
    const agentSettings = await this.agentSettingsService.getLast({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
    })
    const run = await this.extractionAgentSessionsService.executeExtraction({
      connectScope: getRequiredConnectScope(request),
      agent: request.agent,
      agentSettings: agentSettings,
      userId: request.user.id,
      documentId: payload.documentId,
      type: payload.type,
    })
    return { data: { runId: run.id } }
  }

  @Sse(ExtractionAgentSessionsRoutes.streamSessionStatus.path, { method: 0 /* GET */ })
  streamSessionStatus(
    @Req() request: EndpointRequestWithAgent,
  ): Observable<ExtractionAgentSessionStatusChangedEventDto> {
    const connectScope = getRequiredConnectScope(request)
    return this.sessionStatusStreamService.events$.pipe(
      filter(
        (event) =>
          event.organizationId === connectScope.organizationId &&
          event.projectId === connectScope.projectId &&
          event.agentId === request.agent.id,
      ),
      map((event) => ({ ...event, data: JSON.stringify(event) })),
    )
  }

  @Post(ExtractionAgentSessionsRoutes.getAll.path)
  @UseGuards(BaseAgentSessionGuard)
  @CheckPolicy((policy) => policy.canList())
  async getAll(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof ExtractionAgentSessionsRoutes.getAll.request,
  ): Promise<typeof ExtractionAgentSessionsRoutes.getAll.response> {
    const agentSessions = await this.extractionAgentSessionsService.listRuns({
      connectScope: getRequiredConnectScope(request),
      userId: request.user.id,
      agentId: request.agent.id,
      type: payload.type,
    })
    return { data: agentSessions.map(toSummaryDto(payload.type)) }
  }

  @Post(ExtractionAgentSessionsRoutes.getOne.path)
  @UseGuards(BaseAgentSessionGuard)
  @AddContext("agentSession")
  @CheckPolicy((policy) => policy.canList())
  async getOne(
    @Req() request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
    @Body() { payload }: typeof ExtractionAgentSessionsRoutes.getOne.request,
  ): Promise<typeof ExtractionAgentSessionsRoutes.getOne.response> {
    return { data: toDto(payload.type)(request.agentSession) }
  }

  @Post(ExtractionAgentSessionsRoutes.deleteOne.path)
  @UseGuards(BaseAgentSessionGuard)
  @AddContext("agentSession")
  @CheckPolicy((policy) => policy.canDelete())
  async deleteOne(
    @Req() request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
  ): Promise<typeof ExtractionAgentSessionsRoutes.deleteOne.response> {
    await this.baseAgentSessionsService.deleteAgentSession({
      agentType: "extraction",
      agentId: request.agent.id,
      agentSession: request.agentSession,
    })
    return { data: { success: true } }
  }
}

function toSummaryDto(agentSessionType: BaseAgentSessionType) {
  return (entity: ExtractionAgentSession): ExtractionAgentSessionSummaryDto => {
    const traceUrl = agentSessionType === "live" ? undefined : getTraceUrl(entity.traceId)
    return {
      id: entity.id,
      agentId: entity.agentId,
      documentId: entity.documentId,
      documentFileName: entity.document?.fileName ?? null,
      traceUrl,
      type: entity.type,
      status: entity.status,
      createdAt: entity.createdAt.getTime(),
      updatedAt: entity.updatedAt.getTime(),
    }
  }
}

function toDto(agentSessionType: BaseAgentSessionType) {
  return (entity: ExtractionAgentSession): ExtractionAgentSessionDto => {
    return {
      ...toSummaryDto(agentSessionType)(entity),
      result: entity.result,
      errorCode: entity.errorCode,
      errorDetails: entity.errorDetails,
    }
  }
}
