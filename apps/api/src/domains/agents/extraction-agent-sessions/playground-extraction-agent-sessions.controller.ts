import { ExtractionAgentSessionsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "@/common/context/request.interface"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION,
  AGENT_EXTRACTION_SESSION_PLAYGROUND_DELETE_PERMISSION,
  AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import type { ExtractionAgentSession } from "./extraction-agent-session.entity"
import { ExtractionAgentSessionsController } from "./extraction-agent-sessions.controller"

const Routes = ExtractionAgentSessionsRoutes.playground

/**
 * Playground extraction runs, which belong to Studio. The `agent.extraction.session.playground.*`
 * keys keep them to project owners and admins.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class PlaygroundExtractionAgentSessionsController extends ExtractionAgentSessionsController {
  protected readonly type = "playground"

  @Post(Routes.executeOne.path)
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "extractionAgentSession.execute" })
  executeOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof Routes.executeOne.request,
  ): Promise<typeof Routes.executeOne.response> {
    return this.handleExecuteOne(request, payload)
  }

  @Post(Routes.getAll.path)
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION, "project")
  getAll(@Req() request: EndpointRequestWithAgent): Promise<typeof Routes.getAll.response> {
    return this.handleGetAll(request)
  }

  @Post(Routes.getOne.path)
  @AddContext("agentSession")
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION, "project")
  getOne(
    @Req() request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
  ): Promise<typeof Routes.getOne.response> {
    return this.handleGetOne(request)
  }

  @Post(Routes.deleteOne.path)
  @AddContext("agentSession")
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_DELETE_PERMISSION, "project")
  deleteOne(
    @Req() request: EndpointRequestWithAgentSession<ExtractionAgentSession>,
  ): Promise<typeof Routes.deleteOne.response> {
    return this.handleDeleteOne(request)
  }

  @Post(Routes.presignDocument.path)
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION, "project")
  @HttpCode(HttpStatus.CREATED)
  presignDocument(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof Routes.presignDocument.request,
  ): Promise<typeof Routes.presignDocument.response> {
    return this.handlePresignDocument(request, payload)
  }

  @Post(Routes.confirmDocument.path)
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_CREATE_PERMISSION, "project")
  @TrackActivity({ action: "extractionAgentSession.uploadDocument" })
  @HttpCode(HttpStatus.CREATED)
  confirmDocument(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof Routes.confirmDocument.request,
  ): Promise<typeof Routes.confirmDocument.response> {
    return this.handleConfirmDocument(request, payload)
  }

  @Post(Routes.listMyDocuments.path)
  @CheckPermission(AGENT_EXTRACTION_SESSION_PLAYGROUND_READ_PERMISSION, "project")
  listMyDocuments(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof Routes.listMyDocuments.response> {
    return this.handleListMyDocuments(request)
  }
}
