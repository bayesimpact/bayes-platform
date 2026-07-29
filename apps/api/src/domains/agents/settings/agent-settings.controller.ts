import {
  type AgentSettingsDto,
  AgentSettingsRoutes,
  agentPublishSchema,
  updateAgentSettingsSchema,
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
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { TrackActivity } from "@/domains/activities/track-activity.decorator"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import { AgentGuard } from "../agent.guard"
import { extractAgentSettingsUpdateFields } from "./agent.settings.functions"
import type { AgentSettings } from "./agent-settings.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentSettingsService } from "./agent-settings.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, AgentGuard)
@RequireContext("organization", "project")
@Controller()
export class AgentSettingsController {
  constructor(private readonly agentSettingsService: AgentSettingsService) {}

  // canView, not canUpdate or canList: the eval scope reads the published revision of an agent it
  // does not manage, so canUpdate (agent admin/owner) would 403 it. canList only checks
  // project-level access with no agent membership check, which would let any project member read
  // any agent's revisions by id; canView requires agent membership too.
  @Get(AgentSettingsRoutes.getAll.path)
  @CheckPolicy((policy) => policy.canView())
  @AddContext("agent")
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentSettingsRoutes.getAll.response> {
    const agentSettings = await this.agentSettingsService.getAll({
      connectScope: getRequiredConnectScope(request),
      agentId: request.agent.id,
      includesDraft: true,
    })
    return { data: agentSettings.map(toAgentSettingsDto) }
  }

  @Patch(AgentSettingsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  @UsePipes(new ZodValidationPipe(updateAgentSettingsSchema))
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentSettingsRoutes.updateOne.request,
  ): Promise<typeof AgentSettingsRoutes.updateOne.response> {
    const connectScope = getRequiredConnectScope(request)
    const agent = request.agent
    const current = await this.agentSettingsService.getLast({
      connectScope,
      agentId: agent.id,
      includesDraft: true,
    })

    const nextOutputJsonSchema =
      payload.outputJsonSchema !== undefined ? payload.outputJsonSchema : current.outputJsonSchema
    const nextFillFormEnabled =
      payload.fillFormEnabled !== undefined ? payload.fillFormEnabled : current.fillFormEnabled

    if (agent.type === "extraction" && !nextOutputJsonSchema) {
      throw new UnprocessableEntityException("Extraction agent requires outputJsonSchema")
    }
    if (nextFillFormEnabled && !nextOutputJsonSchema) {
      throw new UnprocessableEntityException(
        "outputJsonSchema is required when the fillForm tool is enabled",
      )
    }

    const updated = await this.agentSettingsService.updateSettings({
      connectScope,
      agentId: agent.id,
      agentSettings: {
        ...extractAgentSettingsUpdateFields(current),
        ...payload,
        ...(payload.greetingMessage !== undefined && {
          greetingMessage: normalizeGreetingMessage(payload.greetingMessage),
        }),
      },
    })

    return { data: toAgentSettingsDto(updated) }
  }

  @Post(AgentSettingsRoutes.restoreOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agent.update", entityFrom: "agent" })
  async restoreOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.restoreOne.response> {
    const revision = Number(revisionParam)
    if (!Number.isInteger(revision) || revision < 1) {
      throw new UnprocessableEntityException(`Invalid revision "${revisionParam}"`)
    }

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

    await this.agentSettingsService.updateSettings({
      connectScope,
      agentId: request.agent.id,
      agentSettings: extractAgentSettingsUpdateFields(targetSettings),
    })

    return { data: { success: true } }
  }

  @Post(AgentSettingsRoutes.publishOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  @TrackActivity({ action: "agentSettings.publish", entityFrom: "agent" })
  async publishOne(
    @Req() request: EndpointRequestWithAgent,
    // Scoped to this parameter rather than `@UsePipes()` at the method level: this handler also
    // has a `@Param("revision")` argument, and a method-scoped pipe runs against every parameter,
    // which would feed the revision string through `agentPublishSchema` too and corrupt it.
    @Body(new ZodValidationPipe(agentPublishSchema))
    { payload }: typeof AgentSettingsRoutes.publishOne.request,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.publishOne.response> {
    const revision = Number(revisionParam)
    if (!Number.isInteger(revision) || revision < 1) {
      throw new UnprocessableEntityException(`Invalid revision "${revisionParam}"`)
    }

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
    return { data: toAgentSettingsDto(updated) }
  }

  @Post(AgentSettingsRoutes.archiveOne.path)
  @CheckPolicy((policy) => policy.canDelete())
  @AddContext("agent")
  @TrackActivity({ action: "agentSettings.archive", entityFrom: "agent" })
  async archiveOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("revision") revisionParam: string,
  ): Promise<typeof AgentSettingsRoutes.archiveOne.response> {
    const revision = Number(revisionParam)
    if (!Number.isInteger(revision) || revision < 1) {
      throw new UnprocessableEntityException(`Invalid revision "${revisionParam}"`)
    }

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

export function toAgentSettingsDto(agentSettings: AgentSettings): AgentSettingsDto {
  return {
    id: agentSettings.id,
    agentId: agentSettings.agentId,
    revision: agentSettings.revision,
    revisionName: agentSettings.revisionName ?? "",
    revisionDesc: agentSettings.revisionDesc ?? "",
    isDraft: agentSettings.isDraft,
    isArchived: agentSettings.isArchived,
    instructions: agentSettings.instructions,
    greetingMessage: agentSettings.greetingMessage ?? undefined,
    model: agentSettings.model,
    temperature: Number(agentSettings.temperature),
    locale: agentSettings.locale,
    documentsRagMode: agentSettings.documentsRagMode,
    outputJsonSchema:
      (agentSettings.outputJsonSchema as AgentSettingsDto["outputJsonSchema"]) ?? undefined,
    fillFormEnabled: agentSettings.fillFormEnabled,
    createdAt: agentSettings.createdAt.getTime(),
    updatedAt: agentSettings.updatedAt.getTime(),
  }
}

function normalizeGreetingMessage(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
