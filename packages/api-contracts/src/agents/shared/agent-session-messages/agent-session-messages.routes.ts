import type { RequestPayload, ResponseData } from "../../../generic"
import { defineRoute } from "../../../helpers"
import type { BaseAgentSessionTypeDto } from "../../conversation-agent-sessions/conversation-agent-sessions.dto"
import type {
  AgentSessionMcpAppHtmlDto,
  AgentSessionMessageDto,
  PresignAgentSessionMessageAttachmentDocumentRequestDto,
  PresignAgentSessionMessageAttachmentDocumentResponseDto,
} from "./agent-session-messages.dto"

// Streaming responses are sent as text/event-stream (SSE) and do not follow the usual ResponseData<T> shape.
// We still define a route for path/method typing. The response type is treated as unknown by clients.
export type AgentSessionStreamResponse = unknown

const basePath =
  "organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions/:agentSessionId"
export const AgentSessionMessagesRoutes = {
  getAll: defineRoute<
    ResponseData<AgentSessionMessageDto[]>,
    RequestPayload<{ type: BaseAgentSessionTypeDto }>
  >({
    method: "post",
    path: `${basePath}/messages`,
  }),
  getOne: defineRoute<
    ResponseData<AgentSessionMessageDto>,
    RequestPayload<{ type: BaseAgentSessionTypeDto }>
  >({
    method: "post",
    path: `${basePath}/messages/:messageId`,
  }),
  /**
   * Current HTML of every MCP App card the session's replies point at. Reading it means
   * connecting to each MCP server, so it is separate from `getAll` and loaded once the
   * transcript is already on screen.
   */
  getMcpAppHtml: defineRoute<
    ResponseData<AgentSessionMcpAppHtmlDto[]>,
    RequestPayload<{ type: BaseAgentSessionTypeDto }>
  >({
    method: "post",
    path: `${basePath}/messages/mcp-app-html`,
  }),
  presignAttachmentDocument: defineRoute<
    ResponseData<PresignAgentSessionMessageAttachmentDocumentResponseDto>,
    RequestPayload<
      { type: BaseAgentSessionTypeDto } & PresignAgentSessionMessageAttachmentDocumentRequestDto
    >
  >({
    method: "post",
    path: `${basePath}/messages/attachment-document/presign`,
  }),
  getAttachmentDocumentTemporaryUrl: defineRoute<
    ResponseData<{ url: string }>,
    RequestPayload<{ type: BaseAgentSessionTypeDto }>
  >({
    method: "post",
    path: `${basePath}/messages/attachment-document/:attachmentDocumentId/temporary-url`,
  }),
  stream: defineRoute<
    ResponseData<AgentSessionStreamResponse>,
    RequestPayload<{
      content: string
      attachmentDocumentId?: string
      /**
       * Settings revision the answer must run with. Playground sessions only: a live session
       * that sends one is rejected rather than silently ignored, so a caller can never believe
       * it tested a draft in production. Omitted, a playground session runs the latest revision
       * including the draft and a live session runs the latest published one.
       */
      agentSettingsRevision?: number
    }>
  >({
    method: "post",
    path: `${basePath}/stream`,
  }),
}
