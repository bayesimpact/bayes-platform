import { Injectable, NotFoundException } from "@nestjs/common"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { AgentMembershipRepository } from "@/domains/agents/memberships/agent-membership.repository"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithAgentMembership } from "../request.interface"

@Injectable()
export class AgentMembershipContextResolver implements ContextResolver {
  readonly resource = "agentMembership" as const

  constructor(private readonly agentMembershipRepository: AgentMembershipRepository) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { userId?: string; agentId?: string }
    }
    const userId = requestWithParams.params?.userId
    const agentId = requestWithParams.params?.agentId

    if (!userId || userId === ":userId" || !agentId) {
      throw new NotFoundException()
    }

    const requestWithAgentMembership = request as EndpointRequestWithAgentMembership
    const memberAgentMembership =
      (await this.agentMembershipRepository.findByUserAndAgent({ userId, agentId })) ?? undefined
    if (!memberAgentMembership) throw new NotFoundException()

    requestWithAgentMembership.memberAgentMembership = memberAgentMembership
  }
}
