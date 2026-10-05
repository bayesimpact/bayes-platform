import {
  type AgentMemoryDto,
  type AgentMemorySessionTypeDto,
  type ResolveAgentMemoryProposalsDto,
  AgentMemoriesRoutes as Routes,
  resolveAgentMemoryProposalsSchema,
} from "@caseai-connect/api-contracts"
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RequireContext } from "@/common/context/require-context.decorator"
import { ResourceContextGuard } from "@/common/context/resource-context.guard"
import { ZodValidationPipe } from "@/common/zod-validation-pipe"
import { JwtAuthGuard } from "@/domains/auth/jwt-auth.guard"
import { CheckPermission } from "@/domains/rbac/check-permission.decorator"
import { CheckPermissionGuard } from "@/domains/rbac/check-permission.guard"
import { UserGuard } from "@/domains/users/user.guard"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMemoriesService } from "./agent-memories.service"
import type { AgentMemory } from "./agent-memory.entity"
import type { AgentMemoryOwner } from "./agent-memory.repository"

const SESSION_TYPES: AgentMemorySessionTypeDto[] = ["playground", "live"]

/**
 * The caller's own memories with one agent. Whoever can talk to the agent
 * (`agent.read`) manages what it remembers about them, and only that: every
 * query is keyed on the caller's user id, so no route reaches another user's
 * facts, whatever their role.
 */
@UseGuards(JwtAuthGuard, UserGuard, ResourceContextGuard, CheckPermissionGuard)
@RequireContext("organization", "project", "agent")
@Controller()
export class AgentMemoriesController {
  constructor(private readonly agentMemoriesService: AgentMemoriesService) {}

  @Get(Routes.getAll.path)
  @CheckPermission("agent.read", "agent")
  async getAll(
    @Req() request: EndpointRequestWithAgent,
    @Param("sessionType") sessionType: string,
  ): Promise<typeof Routes.getAll.response> {
    const memories = await this.agentMemoriesService.listForOwner(
      getRequiredConnectScope(request),
      ownerOf(request, sessionType),
    )
    return { data: memories.map(toAgentMemoryDto) }
  }

  @Delete(Routes.deleteOne.path)
  @CheckPermission("agent.read", "agent")
  async deleteOne(
    @Req() request: EndpointRequestWithAgent,
    @Param("sessionType") sessionType: string,
    @Param("memoryId", ParseUUIDPipe) memoryId: string,
  ): Promise<typeof Routes.deleteOne.response> {
    await this.agentMemoriesService.deleteOne(
      getRequiredConnectScope(request),
      ownerOf(request, sessionType),
      memoryId,
    )
    return { data: { success: true } }
  }

  @Delete(Routes.deleteAll.path)
  @CheckPermission("agent.read", "agent")
  async deleteAll(
    @Req() request: EndpointRequestWithAgent,
    @Param("sessionType") sessionType: string,
  ): Promise<typeof Routes.deleteAll.response> {
    await this.agentMemoriesService.deleteAll(
      getRequiredConnectScope(request),
      ownerOf(request, sessionType),
    )
    return { data: { success: true } }
  }

  @Post(Routes.resolveProposals.path)
  @HttpCode(HttpStatus.OK)
  @CheckPermission("agent.read", "agent")
  async resolveProposals(
    @Req() request: EndpointRequestWithAgent,
    @Param("sessionType") sessionType: string,
    @Body(new ZodValidationPipe(resolveAgentMemoryProposalsSchema))
    { payload }: { payload: ResolveAgentMemoryProposalsDto },
  ): Promise<typeof Routes.resolveProposals.response> {
    const saved = await this.agentMemoriesService.resolveProposals(
      getRequiredConnectScope(request),
      ownerOf(request, sessionType),
      payload,
    )
    return { data: saved.map(toAgentMemoryDto) }
  }
}

function ownerOf(request: EndpointRequestWithAgent, sessionType: string): AgentMemoryOwner {
  if (!SESSION_TYPES.includes(sessionType as AgentMemorySessionTypeDto)) {
    throw new BadRequestException("sessionType must be 'playground' or 'live'")
  }
  return {
    agentId: request.agent.id,
    userId: request.user.id,
    sessionType: sessionType as AgentMemorySessionTypeDto,
  }
}

function toAgentMemoryDto(memory: AgentMemory): AgentMemoryDto {
  return {
    id: memory.id,
    content: memory.content,
    origin: memory.origin,
    status: memory.status,
    sourceSessionId: memory.sourceSessionId,
    createdAt: memory.createdAt.getTime(),
    updatedAt: memory.updatedAt.getTime(),
  }
}
