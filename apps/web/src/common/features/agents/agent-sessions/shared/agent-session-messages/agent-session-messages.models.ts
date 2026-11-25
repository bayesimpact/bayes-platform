import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
} from "@bayes-platform/api-contracts"

export type AgentSessionMessage = AgentSessionMessageDto

/** Current HTML of one MCP App card the session points at, loaded after the transcript. */
export type AgentSessionMcpAppHtml = AgentSessionMcpAppHtmlDto
