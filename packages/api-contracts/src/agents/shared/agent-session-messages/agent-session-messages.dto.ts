import type { TimeType } from "../../../generic"

/**
 * Identity of the settings revision that produced a message. Playground surfaces use it to
 * attribute a turn to a revision. `revisionDesc` is deliberately absent: only the session header
 * shows a description, and it reads that from the loaded settings instead.
 */
export type AgentMessageSettingsDto = {
  revision: number
  revisionName: string
  isDraft: boolean
}

export enum ToolName {
  FillForm = "fillForm",
  RetrieveProjectDocumentChunks = "retrieveProjectDocumentChunks",
  Sources = "sources",
  RecalculateConversationSessionMetadata = "recalculateConversationSessionMetadata",
  McpSearchResources = "search_resources",
  McpSmartSearch = "smart_search",
  SurfaceResources = "surfaceResources",
}

export type AgentSessionToolName = ToolName | (string & {})

export type AgentSessionMessageDto = {
  id: string
  role: "user" | "assistant" | "tool"
  content: string
  attachmentDocumentId?: string
  status?: "streaming" | "completed" | "aborted" | "error"
  createdAt?: TimeType
  startedAt?: TimeType
  completedAt?: TimeType
  // The revision that produced this turn. Optional: a message still streaming in the client has
  // not been read back from the API yet.
  agentSettings?: AgentMessageSettingsDto
  toolCalls?: Array<{
    id: string
    name: AgentSessionToolName
    arguments: Record<string, unknown>
  }>
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
