import { Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { ConversationAgentSession } from "@/domains/agents/conversation-agent-sessions/conversation-agent-session.entity"
import { ExtractionAgentSession } from "@/domains/agents/extraction-agent-sessions/extraction-agent-session.entity"
import type { ContextResolver, ResolvableRequest } from "../context-resolver.interface"
import type {
  EndpointRequestWithAgent,
  EndpointRequestWithAgentSession,
} from "../request.interface"

@Injectable()
export class AgentSessionContextResolver implements ContextResolver {
  readonly resource = "agentSession" as const

  constructor(
    @InjectRepository(ConversationAgentSession)
    private readonly conversationAgentSessionRepository: Repository<ConversationAgentSession>,
    @InjectRepository(ExtractionAgentSession)
    private readonly extractionAgentSessionRepository: Repository<ExtractionAgentSession>,
  ) {}

  async resolve(request: ResolvableRequest): Promise<void> {
    const requestWithParams = request as ResolvableRequest & {
      params: { agentSessionId?: string }
    }
    const agentSessionId = requestWithParams.params?.agentSessionId

    if (!agentSessionId || agentSessionId === ":agentSessionId") throw new NotFoundException()

    const requestWithAgent = request as EndpointRequestWithAgent

    const repository =
      requestWithAgent.agent.type === "conversation"
        ? this.conversationAgentSessionRepository
        : requestWithAgent.agent.type === "extraction"
          ? this.extractionAgentSessionRepository
          : undefined

    if (!repository) throw new NotFoundException("Unsupported agent type")

    const agentSession =
      (await repository.findOne({
        where: {
          id: agentSessionId,
          userId: requestWithAgent.user.id,
          organizationId: requestWithAgent.agent.organizationId,
          projectId: requestWithAgent.agent.projectId,
          agentId: requestWithAgent.agent.id,
        },
      })) ?? undefined

    if (!agentSession) throw new NotFoundException("Agent session not found")

    const requestWithAgentSession = request as EndpointRequestWithAgentSession<typeof agentSession>
    requestWithAgentSession.agentSession = agentSession
  }
}
