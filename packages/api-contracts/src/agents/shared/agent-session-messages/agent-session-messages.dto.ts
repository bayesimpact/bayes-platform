import { z } from "zod"
import type { TimeType } from "../../../generic"

export enum ToolName {
  FillForm = "fillForm",
  LookupKnowledgeBase = "lookup_knowledge_base",
  Sources = "sources",
  RecalculateConversationSessionMetadata = "recalculateConversationSessionMetadata",
  McpSearchResources = "search_resources",
  McpSmartSearch = "smart_search",
  SurfaceResources = "surfaceResources",
  /** A sub-agent in handoff mode hands the conversation back to its parent. */
  ConcludeHandoff = "concludeHandoff",
  /** At the end of a hand-over, the platform adds to the form the fields the exchange left empty. */
  ConsolidateForm = "consolidateForm",
  /** The agent stores facts about the user for later conversations (see ADR 0023). */
  SaveMemory = "saveMemory",
  /** The agent removes facts it remembered about the user. */
  ForgetMemory = "forgetMemory",
}

export type AgentSessionToolName = ToolName | (string & {})

/**
 * MCP App attached to a tool. The `ui://` pointer is persisted; `html` is the
 * current `resources/read` result so card UI updates apply to old conversations.
 * Message lists leave it out and clients load it through their `getMcpAppHtml`
 * route, so a slow MCP server never delays the transcript.
 */
export type AgentSessionMcpAppDto = {
  mcpServerId: string
  resourceUri: string
  html?: string
}

/**
 * Domains an MCP App declares in its resource metadata (`_meta.ui.csp` of the MCP Apps spec).
 * The host builds the card's Content Security Policy from them, and blocks every other domain.
 */
export type McpAppCspDto = {
  /** Origins the app may reach with fetch, XHR or WebSocket (`connect-src`). */
  connectDomains?: string[]
  /** Origins the app may load scripts, styles, images, fonts and media from. */
  resourceDomains?: string[]
  /** Origins the app may embed in a frame (`frame-src`). */
  frameDomains?: string[]
  /** Origins the app's `<base>` may point at (`base-uri`). */
  baseUriDomains?: string[]
}

/** Current HTML of one MCP App card used in a session, keyed by the server that serves it. */
export type AgentSessionMcpAppHtmlDto = {
  mcpServerId: string
  resourceUri: string
  html: string
  /** The domains the app declares. Absent when it declares none: the strictest policy applies. */
  csp?: McpAppCspDto
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
  /** The agent that produced this message: the session's agent, or the sub-agent in control. */
  agentId?: string
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

/** Maximum message attachment size in bytes. Matches the chat uploaders (10 MiB). */
export const AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export type PresignAgentSessionMessageAttachmentDocumentRequestDto = {
  fileName: string
  mimeType: AgentSessionMessageAttachmentMimeType
  size: number
}

/**
 * The size is the one the signed upload URL is bound to, so it is capped here, before any URL
 * is made. The file name and MIME type keep their checks in the controller.
 */
export const presignAgentSessionMessageAttachmentDocumentSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number().int().positive().max(AGENT_SESSION_MESSAGE_ATTACHMENT_MAX_BYTES),
})

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
