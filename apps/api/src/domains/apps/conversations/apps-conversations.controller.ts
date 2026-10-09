import {
  AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION,
  AGENT_READ_PERMISSION,
  type AppConversationDto,
  AppsAgentsRoutes,
  AppsConversationsRoutes,
  createAppConversationSchema,
  sendAppConversationMessageSchema,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequest } from "@/common/context/request.interface"
import type { RequiredConnectScope } from "@/common/entities/connect-required-fields"
import { attachTrackedActivity } from "@/domains/activities/attach-tracked-activity"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { ProjectRepository } from "@/domains/projects/project.repository"
import type { AppConversationRecord } from "@/domains/public-chat/public-agent-sessions/public-agent-session.repository"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { AppGuard } from "../app.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AppsConversationsService } from "./apps-conversations.service"

type AppRequest = EndpointRequest & { appProjectId: string; appInstallationId: string }

@Controller()
@UseGuards(AppGuard, CheckPermissionGuard)
export class AppsConversationsController {
  constructor(
    private readonly appsConversationsService: AppsConversationsService,
    private readonly projectRepository: ProjectRepository,
  ) {}

  @CheckPermission(AGENT_READ_PERMISSION, "project")
  @Get(AppsAgentsRoutes.getAll.path)
  async getAllAgents(
    @Param("projectId") projectId: string,
    @Req() request: AppRequest,
  ): Promise<typeof AppsAgentsRoutes.getAll.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const agents = await this.appsConversationsService.listAgents({
      userId: request.user.id,
      connectScope,
    })
    return { data: agents.map((agent) => ({ id: agent.id, name: agent.name })) }
  }

  @CheckPermission(AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION, "agent")
  @Post(AppsConversationsRoutes.createOne.path)
  @HttpCode(HttpStatus.CREATED)
  @TrackActivity({ action: "apps.conversation.create" })
  async createOne(
    @Param("projectId") projectId: string,
    @Param("agentId", ParseUUIDPipe) agentId: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsConversationsRoutes.createOne.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    attachTrackedActivity(request, {
      organizationId: connectScope.organizationId,
      projectId: connectScope.projectId,
    })
    const parsed = createAppConversationSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid conversation payload")
    }

    const conversation = await this.appsConversationsService.createConversation({
      connectScope,
      appInstallationId: request.appInstallationId,
      agentId,
      externalUserId: parsed.data.external_user_id,
    })
    return { data: toAppConversationDto(conversation) }
  }

  @CheckPermission(AGENT_CONVERSATION_SESSION_EXTERNAL_CREATE_PERMISSION, "agent")
  @Post(AppsConversationsRoutes.sendMessage.path)
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param("projectId") projectId: string,
    @Param("agentId", ParseUUIDPipe) agentId: string,
    @Param("conversationId", ParseUUIDPipe) conversationId: string,
    @Req() request: AppRequest,
    @Body() body: unknown,
  ): Promise<typeof AppsConversationsRoutes.sendMessage.response> {
    const connectScope = await this.connectScopeFor(projectId, request)
    const parsed = sendAppConversationMessageSchema.safeParse(body)
    if (!parsed.success) {
      throw new BadRequestException("Invalid message payload")
    }

    const reply = await this.appsConversationsService.sendMessage({
      connectScope,
      appInstallationId: request.appInstallationId,
      agentId,
      conversationId,
      content: parsed.data.content,
    })
    return { data: reply }
  }

  private async connectScopeFor(
    projectId: string,
    request: AppRequest,
  ): Promise<RequiredConnectScope> {
    if (projectId !== request.appProjectId) {
      throw new ForbiddenException("Project does not match the access token")
    }
    const [project] = await this.projectRepository.findPickerProjectsByIds([projectId])
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`)
    }
    return { organizationId: project.organizationId, projectId: project.id }
  }
}

function toAppConversationDto(conversation: AppConversationRecord): AppConversationDto {
  return {
    id: conversation.id,
    agentId: conversation.agentId,
    externalUserId: conversation.externalVisitorId,
    createdAt: conversation.createdAt.getTime(),
  }
}
