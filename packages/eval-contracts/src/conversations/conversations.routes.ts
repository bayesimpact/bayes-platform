import { z } from "zod"
import { AGENT_PATH, PROJECT_PATH } from "../common/params.dto"
import { defineSchemaRoute, defineStreamRoute } from "../define-schema-route"
import {
  attachmentParamsSchema,
  conversationMessageOutputSchema,
  conversationParamsSchema,
  mcpAppHtmlOutputSchema,
  messageFeedbackInputSchema,
  messageParamsSchema,
  presignAttachmentInputSchema,
  presignAttachmentOutputSchema,
  replyInputSchema,
  replyStreamEventSchema,
  temporaryUrlOutputSchema,
} from "./conversations.dto"

const sessionPath = `${AGENT_PATH}/agent-sessions/review_campaign_tester/:agentSessionId`
const messagesPath = `${sessionPath}/messages`

/**
 * A tester's conversation with a campaign's agent, in a session the campaign started: its messages,
 * its files and the stream of the agent's replies.
 */
export const EvalConversationsRoutes = {
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
  /** Gives a thumbs-up to one of the agent's replies, or reports a problem with it. */
  createMessageFeedback: defineSchemaRoute({
    method: "post",
    path: `${PROJECT_PATH}/agent-messages/:agentMessageId/feedbacks`,
    params: messageParamsSchema,
    body: messageFeedbackInputSchema,
    response: z.object({ success: z.boolean() }),
  }),
  /** Sends a message and streams the replies, as server-sent events. */
  streamReply: defineStreamRoute({
    method: "post",
    path: `${sessionPath}/stream`,
    params: conversationParamsSchema,
    body: replyInputSchema,
    event: replyStreamEventSchema,
  }),
}
