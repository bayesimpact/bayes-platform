import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
// biome-ignore lint/style/useImportType: Required at runtime for NestJS DI
import { DataSource } from "typeorm"
import { Agent } from "@/domains/agents/agent.entity"
import type { AgentMembership } from "@/domains/agents/memberships/agent-membership.entity"
import { UserMembership } from "@/domains/memberships/user-membership.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type { EndpointRequestWithAgent, EndpointRequestWithProject } from "../request.interface"

@Injectable()
export class AgentContextResolver implements ContextResolver {
  readonly resource = "agent" as const

  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectDataSource() private readonly dataSource: DataSource,
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
        relations: ["documentTags", "sessionCategories", "resourceLibraries"],
      })) ?? undefined
    if (!agent) throw new NotFoundException()

    const userMembership =
      (await this.dataSource.getRepository(UserMembership).findOne({
        where: {
          userId: request.user.id,
          resourceId: agent.id,
          resourceType: "agent",
        },
      })) ?? undefined

    // TODO (cleanup PR): once AgentMembership is removed, narrow the
    // request-interface type for agentMembership to a Pick of only what
    // policies actually read (agentId, role today), drop the `as` cast
    // below, and load the `agent` / `user` relations only if a policy
    // starts needing them.
    //
    // The `as AgentMembership` below is intentional: we build a plain DTO
    // from user_membership rows rather than a real entity instance, so the
    // `agent` and `user` relation fields are absent. TypeScript would reject
    // `satisfies AgentMembership` because of those missing fields. At runtime
    // this is safe — AgentPolicy and InvitationPolicy only read
    // `agentMembership.agentId` and `agentMembership.role`; the relation
    // fields are never accessed.
    const agentMembership: AgentMembership | undefined = userMembership
      ? ({
          id: userMembership.id,
          userId: userMembership.userId,
          agentId: agent.id,
          role: userMembership.role,
          createdAt: userMembership.createdAt,
          updatedAt: userMembership.updatedAt,
          deletedAt: userMembership.deletedAt,
        } as AgentMembership)
      : undefined

    const requestWithAgent = request as EndpointRequestWithAgent
    requestWithAgent.agent = agent
    requestWithAgent.agentMembership = agentMembership
  }
}
