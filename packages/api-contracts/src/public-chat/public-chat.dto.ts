import type { TimeType } from "../generic"

export type AgentEmbedConfigDto = {
  id: string
  agentId: string
  embedToken: string
  isEnabled: boolean
  allowedOrigins: string[]
  createdAt: TimeType
  updatedAt: TimeType
}

export type PublicSessionMessageDto = {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt: TimeType
}

export type PublicAgentSessionDto = {
  id: string
  agentId: string
  messages: PublicSessionMessageDto[]
  createdAt: TimeType
}

export type CreatePublicSessionRequestDto = {
  externalVisitorId?: string
}

export type CreatePublicSessionResponseDto = {
  sessionId: string
  sessionToken: string
}
