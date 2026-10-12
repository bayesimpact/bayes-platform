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

const agentSessionsPath =
  "organizations/:organizationId/projects/:projectId/agents/:agentId/agent-sessions"

/** Live and playground sessions each get their own route set, so each has its own permissions. */
function defineAgentSessionMessagesRoutes(type: BaseAgentSessionTypeDto) {
  const prefix = `${agentSessionsPath}/${type}/:agentSessionId/messages`

  return {
    getAll: defineRoute<ResponseData<AgentSessionMessageDto[]>>({
      method: "post",
      path: prefix,
    }),
    /**
     * Current HTML of every MCP App card the session's replies point at. Reading it means
     * connecting to each MCP server, so it is separate from `getAll` and loaded once the
     * transcript is already on screen.
     */
    getMcpAppHtml: defineRoute<ResponseData<AgentSessionMcpAppHtmlDto[]>>({
      method: "post",
      path: `${prefix}/mcp-app-html`,
    }),
    getOne: defineRoute<ResponseData<AgentSessionMessageDto>>({
      method: "post",
      path: `${prefix}/:messageId`,
    }),
    presignAttachmentDocument: defineRoute<
      ResponseData<PresignAgentSessionMessageAttachmentDocumentResponseDto>,
      RequestPayload<PresignAgentSessionMessageAttachmentDocumentRequestDto>
    >({
      method: "post",
      path: `${prefix}/attachment-document/presign`,
    }),
    getAttachmentDocumentTemporaryUrl: defineRoute<ResponseData<{ url: string }>>({
      method: "post",
      path: `${prefix}/attachment-document/:attachmentDocumentId/temporary-url`,
    }),
  }
}

export const AgentSessionMessagesRoutes = {
  live: defineAgentSessionMessagesRoutes("live"),
  playground: defineAgentSessionMessagesRoutes("playground"),
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
    path: `${agentSessionsPath}/:agentSessionId/stream`,
  }),
}
