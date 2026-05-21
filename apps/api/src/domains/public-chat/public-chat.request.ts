import type { Request } from "express"
import type { Agent } from "@/domains/agents/agent.entity"
import type { PublicAgentSession } from "./public-agent-sessions/public-agent-session.entity"

export interface PublicChatRequest extends Request {
  agent: Agent
}

export interface PublicChatSessionRequest extends PublicChatRequest {
  publicSession: PublicAgentSession
}
