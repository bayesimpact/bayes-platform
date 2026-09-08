import type { TimeType } from "../../../generic"

export enum ToolName {
  FillForm = "fillForm",
  LookupKnowledgeBase = "lookup_knowledge_base",
  Sources = "sources",
  RecalculateConversationSessionMetadata = "recalculateConversationSessionMetadata",
  McpSearchResources = "search_resources",
  McpSmartSearch = "smart_search",
  SurfaceResources = "surfaceResources",
  /**
   * Composite turn-summary tool exposed to the LLM: one call carries the
   * used chunkIds (sources) and/or the session categorization. Its execution
   * is logged as separate Sources / RecalculateConversationSessionMetadata
   * entries so persisted tool calls and the UI keep their historical names.
   */
  MandatoryTool = "mandatory_tool",
}

export type AgentSessionToolName = ToolName | (string & {})

/**
 * MCP App attached to a tool. The `ui://` pointer is persisted; `html` is the
 * current `resources/read` result so card UI updates apply to old conversations.
 * Authenticated sessions leave it out of the message list and load it through
 * `getMcpAppHtml`, so a slow MCP server never delays the transcript. The public
 * chat still hydrates it inline.
 */
export type AgentSessionMcpAppDto = {
  mcpServerId: string
  resourceUri: string
  html?: string
}

/** Current HTML of one MCP App card used in a session, keyed by the server that serves it. */
export type AgentSessionMcpAppHtmlDto = {
  mcpServerId: string
  resourceUri: string
  html: string
}

export type AgentSessionToolCallDto = {
  id: string
  name: AgentSessionToolName
  arguments: Record<string, unknown>
  /** Raw MCP tool result (`content`, `structuredContent`, `_meta`) when an MCP App is rendered. */
  result?: unknown
  mcpApp?: AgentSessionMcpAppDto
}

export type AgentSessionMessageDto = {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  attachmentDocumentId?: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt?: TimeType
  startedAt?: TimeType
  completedAt?: TimeType
  /**
   * Revision of the agent settings that produced this message. The client also sets it on the
   * assistant message it builds optimistically, from the version the request named, so the badge
   * stays right until the persisted message replaces it.
   */
  agentRevision?: number
  toolCalls?: AgentSessionToolCallDto[]
}

export const agentSessionMessageAttachmentAllowedMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
] as const

export type AgentSessionMessageAttachmentMimeType =
  (typeof agentSessionMessageAttachmentAllowedMimeTypes)[number]

/** For `FileUploader` / dropzone `accept` (one flag per distinct MIME string). */
export const agentSessionMessageAttachmentAllowedMimeTypesForFileUploader = Object.fromEntries(
  agentSessionMessageAttachmentAllowedMimeTypes.map((mimeType) => [mimeType, true]),
) as Partial<Record<AgentSessionMessageAttachmentMimeType, boolean>>

export type PresignAgentSessionMessageAttachmentDocumentRequestDto = {
  fileName: string
  mimeType: AgentSessionMessageAttachmentMimeType
  size: number
}

export type PresignAgentSessionMessageAttachmentDocumentResponseDto = {
  attachmentDocumentId: string
  uploadUrl: string
}

export type StreamEventPayload =
  | { type: "start"; messageId: string }
  | { type: "chunk"; content: string; messageId: string }
  | { type: "notify_client"; toolName: AgentSessionToolName }
  | { type: "end"; messageId: string; fullContent: string }
  | { type: "error"; messageId: string; error: string }

export type StreamEvent = MessageEvent & StreamEventPayload
