import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithAgent, EndpointRequestWithProject } from "../request.interface"

@Injectable()
export class AgentContextResolver implements ContextResolver {
  readonly resource = "agent" as const

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { agentId?: string }
    }
    const agentId = requestWithParams.params?.agentId

    if (!agentId || agentId === ":agentId") throw new NotFoundException()

    const requestWithProject = request as EndpointRequestWithProject
    const agent =
      (await this.agentRepository.findOne({
        where: {
          id: agentId,
          organizationId: requestWithProject.organizationId,
          projectId: requestWithProject.project.id,
        },
        relations: {
          documentTags: true,
          sessionCategories: true,
          resourceLibraries: true,
          agentMcpServers: { mcpServer: true },
        },
      })) ?? undefined
    if (!agent) throw new NotFoundException()

    const requestWithAgent = request as EndpointRequestWithAgent
    requestWithAgent.agent = agent
  }
}
