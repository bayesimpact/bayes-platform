import { DeskMemoriesRoutes, type MemoryOutputDto } from "@bayes-platform/desk-contracts"
import { Controller, HttpStatus, Req } from "@nestjs/common"
import type { EndpointRequestWithAgent } from "@/common/context/request.interface"
import { getRequiredConnectScope } from "@/common/context/request-context.helpers"
import { RouteInput } from "@/common/schema-route/route-input.decorator"
import { SchemaRoute } from "@/common/schema-route/schema-route.decorator"
import type {
  SchemaRouteInput,
  SchemaRouteResponse,
} from "@/common/schema-route/schema-route.types"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMemoriesService } from "@/domains/agents/memories/agent-memories.service"

const MEMORY_CONTEXT = ["organization", "project", "agent"] as const

type MemoryOwner = Parameters<AgentMemoriesService["listForOwner"]>[1]
type Memory = Awaited<ReturnType<AgentMemoriesService["listForOwner"]>>[number]

/**
 * The caller's own memories with one agent. Whoever can talk to the agent (`agent.read`) manages
 * what it remembers about them, and only that: every query is keyed on the caller's user id, so no
 * route reaches another user's facts, whatever their role. A copy of `AgentMemoriesController`
 * with the session type fixed to `live`.
 */
@Controller()
export class DeskMemoriesController {
  constructor(private readonly agentMemoriesService: AgentMemoriesService) {}

  @SchemaRoute(DeskMemoriesRoutes.getAll, {
    permission: { key: "agent.read", on: "agent" },
    context: [...MEMORY_CONTEXT],
  })
  async getAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskMemoriesRoutes.getAll>> {
    const memories = await this.agentMemoriesService.listForOwner(
      getRequiredConnectScope(request),
      ownerOf(request),
    )
    return { data: memories.map(toMemoryDto) }
  }

  @SchemaRoute(DeskMemoriesRoutes.deleteOne, {
    permission: { key: "agent.read", on: "agent" },
    context: [...MEMORY_CONTEXT],
  })
  async deleteOne(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { params }: SchemaRouteInput<typeof DeskMemoriesRoutes.deleteOne>,
  ): Promise<SchemaRouteResponse<typeof DeskMemoriesRoutes.deleteOne>> {
    await this.agentMemoriesService.deleteOne(
      getRequiredConnectScope(request),
      ownerOf(request),
      params.memoryId,
    )
    return { data: { success: true } }
  }

  @SchemaRoute(DeskMemoriesRoutes.deleteAll, {
    permission: { key: "agent.read", on: "agent" },
    context: [...MEMORY_CONTEXT],
  })
  async deleteAll(
    @Req() request: EndpointRequestWithAgent,
  ): Promise<SchemaRouteResponse<typeof DeskMemoriesRoutes.deleteAll>> {
    await this.agentMemoriesService.deleteAll(getRequiredConnectScope(request), ownerOf(request))
    return { data: { success: true } }
  }

  @SchemaRoute(DeskMemoriesRoutes.resolveProposals, {
    permission: { key: "agent.read", on: "agent" },
    context: [...MEMORY_CONTEXT],
    status: HttpStatus.OK,
  })
  async resolveProposals(
    @Req() request: EndpointRequestWithAgent,
    @RouteInput() { payload }: SchemaRouteInput<typeof DeskMemoriesRoutes.resolveProposals>,
  ): Promise<SchemaRouteResponse<typeof DeskMemoriesRoutes.resolveProposals>> {
    const saved = await this.agentMemoriesService.resolveProposals(
      getRequiredConnectScope(request),
      ownerOf(request),
      payload,
    )
    return { data: saved.map(toMemoryDto) }
  }
}

function ownerOf(request: EndpointRequestWithAgent): MemoryOwner {
  return { agentId: request.agent.id, userId: request.user.id, sessionType: "live" }
}

function toMemoryDto(memory: Memory): MemoryOutputDto {
  return {
    id: memory.id,
    content: memory.content,
    status: memory.status,
    createdAt: memory.createdAt.getTime(),
  }
}
