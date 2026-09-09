import type {
  EmbedPublicConfigDto,
  PublicAgentSessionDto,
  PublicSessionMessageDto,
} from "@caseai-connect/api-contracts"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"

/**
 * Wire shapes of the public chat API (`docs/public-api-contract.md`). Pure
 * functions, so the contract stays visible in one place and out of the service.
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
export function toEmbedPublicConfigDto(embedConfig: AgentEmbedConfig): EmbedPublicConfigDto {
  return {
    agentName: embedConfig.agent.name,
    title: embedConfig.title,
    logoUrl: embedConfig.logoUrl,
    primaryColor: embedConfig.primaryColor,
    bannerText: embedConfig.bannerText,
  }
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
