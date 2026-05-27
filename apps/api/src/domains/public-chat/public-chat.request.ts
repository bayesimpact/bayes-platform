import type { Request } from "express"
import type { AgentEmbedConfig } from "./agent-embed-configs/agent-embed-config.entity"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"

export interface PublicChatRequest extends Request {
  embedConfig: AgentEmbedConfig
}

export interface PublicChatSessionRequest extends PublicChatRequest {
  publicSession: PublicAgentSession
}
