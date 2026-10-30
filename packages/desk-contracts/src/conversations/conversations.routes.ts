import { z } from "zod"
import { AGENT_PATH, agentParamsSchema, PROJECT_PATH } from "../common/params.dto"
import { defineSchemaRoute, defineStreamRoute } from "../define-schema-route"
import { temporaryUrlOutputSchema } from "../documents/documents.dto"
import {
  attachmentParamsSchema,
  conversationMessageOutputSchema,
  conversationParamsSchema,
  createdConversationOutputSchema,
  mcpAppHtmlOutputSchema,
  messageFeedbackInputSchema,
  messageParamsSchema,
  presignAttachmentInputSchema,
  presignAttachmentOutputSchema,
  replyStreamEventSchema,
  replyStreamQuerySchema,
} from "./conversations.dto"

const conversationPath = `${AGENT_PATH}/conversation-agent-sessions/live/:agentSessionId`
const messagesPath = `${AGENT_PATH}/agent-sessions/live/:agentSessionId/messages`

/** A person's live conversations with a conversation agent. */
export const DeskConversationsRoutes = {
  createOne: defineSchemaRoute({
    method: "post",
    path: `${AGENT_PATH}/conversation-agent-sessions/live/create`,
    params: agentParamsSchema,
    body: z.strictObject({}),
    response: createdConversationOutputSchema,
  }),
  deleteOne: defineSchemaRoute({
    method: "post",
    path: `${conversationPath}/delete`,
    params: conversationParamsSchema,
    response: z.object({ success: z.boolean() }),
  }),
  getMessages: defineSchemaRoute({
    method: "post",
    path: messagesPath,
    params: conversationParamsSchema,
    response: z.array(conversationMessageOutputSchema),
  }),
  /**
   * The current HTML of every MCP App the conversation's replies show. Reading it connects to
   * each MCP server, so it loads after the messages.
   */
  getMcpAppsHtml: defineSchemaRoute({
    method: "post",
    path: `${messagesPath}/mcp-app-html`,
    params: conversationParamsSchema,
    response: z.array(mcpAppHtmlOutputSchema),
  }),
  /** Prepares the upload of a file to attach to the next message. */
  presignAttachment: defineSchemaRoute({
    method: "post",
    path: `${messagesPath}/attachment-document/presign`,
    params: conversationParamsSchema,
    body: presignAttachmentInputSchema,
    response: presignAttachmentOutputSchema,
  }),
  getAttachmentUrl: defineSchemaRoute({
    method: "post",
    path: `${messagesPath}/attachment-document/:attachmentDocumentId/temporary-url`,
    params: attachmentParamsSchema,
    response: temporaryUrlOutputSchema,
  }),
  /** Reports a problem with one of the agent's replies. */
  createMessageFeedback: defineSchemaRoute({
    method: "post",
    path: `${PROJECT_PATH}/agent-messages/:agentMessageId/feedbacks`,
    params: messageParamsSchema,
    body: messageFeedbackInputSchema,
    response: z.object({ success: z.boolean() }),
  }),
  /** Sends a message and streams the replies, as server-sent events. */
  streamReply: defineStreamRoute({
    method: "get",
    path: `${messagesPath}/stream`,
    params: conversationParamsSchema,
    query: replyStreamQuerySchema,
    event: replyStreamEventSchema,
  }),
}
