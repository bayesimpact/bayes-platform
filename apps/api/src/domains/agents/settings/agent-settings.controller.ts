import {
  AgentSettingsRoutes,
  partialUpdateAgentSettingsSchema,
} from "@caseai-connect/api-contracts"
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
  UsePipes,
} from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import {
  AGENT_READ_PERMISSION,
  AGENT_SETTINGS_ARCHIVE_PERMISSION,
  AGENT_SETTINGS_DRAFT_PUBLISH_PERMISSION,
  AGENT_SETTINGS_DRAFT_READ_PERMISSION,
  AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION,
  AGENT_SETTINGS_RESTORE_PERMISSION,
} from "@/domains/rbac/rbac.constants"
import { UserGuard } from "@/domains/users/user.guard"
import { toAgentSettingsDto } from "./agent-settings.mappers"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "./agent-settings.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentSettingsController {
  constructor(private readonly agentSettingsService: AgentSettingsService) {}

  // History timeline of all revisions for the agent settings, including drafts and published revisions.
  @Get(AgentSettingsRoutes.getAllWithDraft.path)
  @CheckPermission(AGENT_SETTINGS_DRAFT_READ_PERMISSION, "agent")
  async getAllWithDraft(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentSettingsRoutes.getAllWithDraft.response> {
    const connectScope = getRequiredConnectScope(request)
    const agent = request.agent

    const agentSettingsWithDraft = await this.agentSettingsService.getAll({
      connectScope,
      agentId: agent.id,
      includesDraft: true,
    })

    const results = agentSettingsWithDraft.map(async (settings) => {
      return toAgentSettingsDto({ agent, agentSettings: settings })
    })
    return { data: await Promise.all(results) }
  }

  // Output JSON schema of a given revision, used to render the fill form on the session side.
  @Get(AgentSettingsRoutes.getFillFormOutputJsonSchema.path)
  @CheckPermission(AGENT_READ_PERMISSION, "agent")
  async getFillFormOutputJsonSchema(
    @Req() request: EndpointRequestWithAgent,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.getFillFormOutputJsonSchema.response> {
    const revision = parseRevision(revisionParam)
    const connectScope = getRequiredConnectScope(request)
    const agentId = request.agent.id

    const agentSettings = await this.agentSettingsService.get({ connectScope, agentId, revision })
    if (!agentSettings) {
      throw new NotFoundException(`Revision ${revision} not found for agent with id ${agentId}`)
    }

    if (!agentSettings.fillFormEnabled) {
      return { data: undefined }
    }

    return { data: agentSettings.outputJsonSchema ?? undefined }
  }

  @Post(AgentSettingsRoutes.restoreOne.path)
  @CheckPermission(AGENT_SETTINGS_RESTORE_PERMISSION, "agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  async restoreOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.restoreOne.response> {
    const revision = Number(revisionParam)
    if (!Number.isInteger(revision) || revision < 1) {
      throw new UnprocessableEntityException(`Invalid revision "${revisionParam}"`)
    }

    const agentId = request.agent.id
    const connectScope = getRequiredConnectScope(request)
    const targetSettings = await this.agentSettingsService.get({
      connectScope,
      agentId,
      revision,
    })
    if (!targetSettings) {
      throw new NotFoundException(`Revision ${revision} not found for agent with id ${agentId}`)
    }

    const isRestored = await this.agentSettingsService.updateAllSettings({
      connectScope,
      agentId,
      fieldsToUpdate: targetSettings,
    })

    if (!isRestored) {
      throw new UnprocessableEntityException(
        `Unable to restore revision ${revision} for agent with id ${agentId}`,
      )
    }

    return { data: { success: true } }
  }

  @Post(AgentSettingsRoutes.createOne.path)
  @CheckPermission(AGENT_SETTINGS_DRAFT_PUBLISH_PERMISSION, "agent")
  @TrackActivity({ action: "agentSettings.create", entityFrom: "agentSettings" })
  async createOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentSettingsRoutes.createOne.request,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.createOne.response> {
    const revision = parseRevision(revisionParam)
    const connectScope = getRequiredConnectScope(request)
    const targetSettings = await this.agentSettingsService.get({
      connectScope,
      agentId: request.agent.id,
      revision,
    })
    if (!targetSettings) {
      throw new NotFoundException(
        `Revision ${revision} not found for agent with id ${request.agent.id}`,
      )
    }
    const { revisionName, revisionDesc } = payload
    const updated = await this.agentSettingsService.publish({
      connectScope,
      agentId: request.agent.id,
      revision,
      revisionName,
      revisionDesc,
    })
    if (!updated) {
      throw new UnprocessableEntityException(
        `Unable to publish revision ${revision} for agent with id ${request.agent.id}`,
      )
    }
    return { data: { success: true } }
  }

  @Patch(AgentSettingsRoutes.updateOne.path)
  @CheckPermission(AGENT_SETTINGS_DRAFT_UPDATE_PERMISSION, "agent")
  @TrackActivity({ action: "agentSettings.update", entityFrom: "agentSettings" })
  @UsePipes(new ZodValidationPipe(partialUpdateAgentSettingsSchema))
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentSettingsRoutes.updateOne.request,
  ): Promise<typeof AgentSettingsRoutes.updateOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agentId = request.agent.id

    const updated = await this.agentSettingsService.updateAllSettings({
      connectScope,
      agentId,
      fieldsToUpdate: payload,
    })
    if (!updated) {
      throw new UnprocessableEntityException(
        `Unable to update agent settings for agent with id ${request.agent.id}`,
      )
    }

    return { data: { success: true } }
  }

  @Post(AgentSettingsRoutes.archiveOne.path)
  @CheckPermission(AGENT_SETTINGS_ARCHIVE_PERMISSION, "agent")
  @TrackActivity({ action: "agentSettings.archive", entityFrom: "agentSettings" })
  async archiveOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.archiveOne.response> {
    const revision = parseRevision(revisionParam)
    const connectScope = getRequiredConnectScope(request)

    const targetSettings = await this.agentSettingsService.get({
      connectScope,
      agentId: request.agent.id,
      revision,
    })
    if (!targetSettings) {
      throw new NotFoundException(
        `Revision ${revision} not found for agent with id ${request.agent.id}`,
      )
    }
    const archived = await this.agentSettingsService.archive({
      connectScope,
      agentId: request.agent.id,
      revision,
    })
    if (!archived || !archived.success) {
      throw new UnprocessableEntityException(
        `Unable to archive revision ${revision} for agent with id ${request.agent.id}`,
      )
    }
    return { data: { success: true } }
  }
}

function parseRevision(revisionParam: string): number {
  const revision = Number(revisionParam)
  if (!Number.isInteger(revision) || revision < 1) {
    throw new UnprocessableEntityException(`Invalid revision "${revisionParam}"`)
  }
  return revision
}
