import { defineSchemaRoute, defineStreamRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
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
} from "./conversations.dto"
import {
  documentIsPublicOutputSchema,
  documentParamsSchema,
  temporaryUrlOutputSchema,
} from "./documents.dto"

/**
 * The path of a project in the routes of an app, the `PROJECT_PATH` of its contracts
 * (`desk/organizations/:organizationId/projects/:projectId`). Its type keeps the `:name` segments,
 * so `defineSchemaRoute` still checks each route's params against its path.
 */
export type ProjectPath = `${string}/organizations/:organizationId/projects/:projectId`

/**
 * The routes of a conversation under an app's project path, in the sessions of one type (`live`
 * for the Desk, `review_campaign_tester` for Evaluation): its messages, its files, the feedback on
 * its replies and the stream of the agent's replies. Each app spreads them in its own routes.
 * The name does not end in `Routes`, which the API's routes specs read as a routes object.
 */
export function conversationRoutesAt(projectPath: ProjectPath, sessionType: string) {
  const sessionPath =
    `${projectPath}/agents/:agentId/agent-sessions/${sessionType}/:agentSessionId` as const
  const messagesPath = `${sessionPath}/messages` as const
  return {
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
      path: `${projectPath}/agent-messages/:agentMessageId/feedbacks`,
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
}

/** The routes of a conversation, whatever its app: what the chat reads and sends. */
export type ConversationRoutes = ReturnType<typeof conversationRoutesAt>

/** The routes of the documents a reply cites as its sources, under an app's project path. */
export function documentsRoutesAt(projectPath: ProjectPath) {
  const documentPath = `${projectPath}/documents/:documentId` as const
  return {
    getIsPublic: defineSchemaRoute({
      method: "get",
      path: `${documentPath}/is-public`,
      params: documentParamsSchema,
      response: documentIsPublicOutputSchema,
    }),
    /** Answers 403 for a document that is not public, to a person who cannot read the project's documents. */
    getTemporaryUrl: defineSchemaRoute({
      method: "get",
      path: `${documentPath}/temporary-url`,
      params: documentParamsSchema,
      response: temporaryUrlOutputSchema,
    }),
  }
}

/** The routes of the documents a reply cites, whatever its app. */
export type DocumentsRoutes = ReturnType<typeof documentsRoutesAt>
