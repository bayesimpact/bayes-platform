import { z } from "zod"
import { agentParamsSchema } from "../agent-sessions/agent-sessions.dto"
import { defineSchemaRoute, defineStreamRoute } from "../define-schema-route"
import {
  conversationMessageOutputSchema,
  conversationParamsSchema,
  createdConversationOutputSchema,
  messageFeedbackInputSchema,
  messageParamsSchema,
  replyStreamEventSchema,
  replyStreamQuerySchema,
} from "./conversations.dto"

const agentPath = "organizations/:organizationId/projects/:projectId/agents/:agentId"
const conversationPath = `${agentPath}/conversation-agent-sessions/live/:agentSessionId`
const messagesPath = `${agentPath}/agent-sessions/live/:agentSessionId/messages`

/** A person's live conversations with a conversation agent. */
export const DeskConversationsRoutes = {
  createOne: defineSchemaRoute({
    method: "post",
    path: `${agentPath}/conversation-agent-sessions/live/create`,
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
  /** Reports a problem with one of the agent's replies. */
  createMessageFeedback: defineSchemaRoute({
    method: "post",
    path: "organizations/:organizationId/projects/:projectId/agent-messages/:agentMessageId/feedbacks",
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
