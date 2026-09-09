import type {
  CreatePublicSessionResponseDto,
  LegacyEmbedPublicConfigDto,
  PublicAgentSessionDto,
  PublicSessionMessageDto,
} from "@caseai-connect/api-contracts"
import type { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "../public-agent-sessions/public-agent-session.entity"

/**
 * Wire shapes of the legacy alias of the public chat API (`docs/public-api-contract.md`). Pure
 * functions owned by the legacy controller: the alias must keep answering exactly as it did
 * before versioning, so v1 additions (`bannerText`, MCP App HTML) do not appear here.
 */

/** The message fields the public transcript exposes (structural, so no cross-domain entity import). */
type PublicMessageSource = {
  id: string
  role: PublicSessionMessageDto["role"]
  content: string
  status: NonNullable<PublicSessionMessageDto["status"]> | null
  createdAt: Date
  toolCalls: NonNullable<PublicSessionMessageDto["toolCalls"]> | null
}

/** Branding only, no secrets: what an anonymous host page may learn about the agent. */
export function toEmbedPublicConfigDto(embedConfig: AgentEmbedConfig): LegacyEmbedPublicConfigDto {
  return {
    agentName: embedConfig.agent.name,
    title: embedConfig.title,
    logoUrl: embedConfig.logoUrl,
    primaryColor: embedConfig.primaryColor,
  }
}

export function toCreatePublicSessionResponseDto(
  session: PublicAgentSession,
  sessionToken: string,
): CreatePublicSessionResponseDto {
  return { sessionId: session.id, sessionToken }
}

export function toPublicAgentSessionDto(
  session: PublicAgentSession,
  messages: PublicMessageSource[],
): PublicAgentSessionDto {
  return {
    id: session.id,
    agentId: session.agentId,
    messages: messages.map(toPublicSessionMessageDto),
    createdAt: session.createdAt.getTime(),
  }
}

function toPublicSessionMessageDto(message: PublicMessageSource): PublicSessionMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status ?? undefined,
    createdAt: message.createdAt.getTime(),
    toolCalls: message.toolCalls ?? undefined,
  }
}
