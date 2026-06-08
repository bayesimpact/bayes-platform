import { type AgentEmbedConfigDto, AgentEmbedConfigsRoutes } from "@caseai-connect/api-contracts"
import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { AddContext, RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { CheckPolicy } from "@/common/policies/check-policy.decorator"
import { AgentGuard } from "@/domains/agents/agent.guard"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { UserGuard } from "@/domains/users/user.guard"
import type { AgentEmbedConfig } from "./agent-embed-config.entity"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentEmbedConfigsService } from "./agent-embed-configs.service"

@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, AgentGuard)
@RequireContext("organization", "project")
@Controller()
export class AgentEmbedConfigsManagementController {
  constructor(private readonly agentEmbedConfigsService: AgentEmbedConfigsService) {}

  @Get(AgentEmbedConfigsRoutes.getOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  async getOne(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<typeof AgentEmbedConfigsRoutes.getOne.response> {
    const { organizationId, projectId } = getRequiredConnectScope(request)
    const config = await this.agentEmbedConfigsService.upsert({
      agentId: request.agent.id,
      organizationId,
      projectId,
    })
    return { data: toAgentEmbedConfigDto(config) }
  }

  @Patch(AgentEmbedConfigsRoutes.updateOne.path)
  @CheckPolicy((policy) => policy.canUpdate())
  @AddContext("agent")
  async updateOne(
    @Req() request: EndpointRequestWithAgent,
    @Body() { payload }: typeof AgentEmbedConfigsRoutes.updateOne.request,
  ): Promise<typeof AgentEmbedConfigsRoutes.updateOne.response> {
    const { isEnabled, allowedOrigins, title, logoUrl, primaryColor, displayMode } = payload ?? {}
    await this.agentEmbedConfigsService.update(request.agent.id, {
      isEnabled,
      allowedOrigins,
      title,
      logoUrl,
      primaryColor,
      displayMode,
    })
    return { data: { success: true } }
  }
}

function toAgentEmbedConfigDto(entity: AgentEmbedConfig): AgentEmbedConfigDto {
  return {
    id: entity.id,
    agentId: entity.agentId,
    embedToken: entity.embedToken,
    isEnabled: entity.isEnabled,
    allowedOrigins: entity.allowedOrigins,
    title: entity.title,
    logoUrl: entity.logoUrl,
    primaryColor: entity.primaryColor,
    displayMode: entity.displayMode,
    createdAt: entity.createdAt.getTime(),
    updatedAt: entity.updatedAt.getTime(),
  }
}
