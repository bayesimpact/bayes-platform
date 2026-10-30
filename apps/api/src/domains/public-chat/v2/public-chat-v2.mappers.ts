import type { PublicChatV2 } from "@caseai-connect/api-contracts"
import type { AgentEmbedConfig } from "../agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "../public-agent-sessions/public-agent-session.entity"

/**
 * Wire shapes of the public chat API v2 (`docs/public-api-contract.md`). Pure
 * functions owned by the v2 controller: a change here is a change to the v2 contract.
 */

/** The message fields the public transcript exposes (structural, so no cross-domain entity import). */
type PublicMessageSource = {
  id: string
  role: PublicChatV2.PublicSessionMessageDto["role"]
  content: string
  status: NonNullable<PublicChatV2.PublicSessionMessageDto["status"]> | null
  createdAt: Date
  toolCalls: NonNullable<PublicChatV2.PublicSessionMessageDto["toolCalls"]> | null
}

/** Branding only, no secrets: what an anonymous host page may learn about the agent. */
export function toEmbedPublicConfigDto(
  embedConfig: AgentEmbedConfig,
): PublicChatV2.EmbedPublicConfigDto {
  return {
    agentName: embedConfig.agent.name,
    title: embedConfig.title,
    logoUrl: embedConfig.logoUrl,
    primaryColor: embedConfig.primaryColor,
    bannerText: embedConfig.bannerText,
  }
}

export function toCreatePublicSessionResponseDto(
  session: PublicAgentSession,
  sessionToken: string,
): PublicChatV2.CreatePublicSessionResponseDto {
  return { sessionId: session.id, sessionToken }
}

export function toPublicAgentSessionDto(
  session: PublicAgentSession,
  messages: PublicMessageSource[],
): PublicChatV2.PublicAgentSessionDto {
  return {
    id: session.id,
    agentId: session.agentId,
    messages: messages.map(toPublicSessionMessageDto),
    createdAt: session.createdAt.getTime(),
  }
}

function toPublicSessionMessageDto(
  message: PublicMessageSource,
): PublicChatV2.PublicSessionMessageDto {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status ?? undefined,
    createdAt: message.createdAt.getTime(),
    toolCalls: message.toolCalls ?? undefined,
  }
}
