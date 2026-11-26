import { conversationParamsSchema, conversationRoutesAt } from "@caseai-connect/chat-contracts"
import { defineSchemaRoute } from "@caseai-connect/schema-route"
import { z } from "zod"
import { AGENT_PATH, agentParamsSchema, PROJECT_PATH } from "../common/params.dto"
import { createdConversationOutputSchema } from "./conversations.dto"

const conversationPath = `${AGENT_PATH}/conversation-agent-sessions/live/:agentSessionId`

/**
 * A person's live conversations with a conversation agent: the Desk starts and deletes them, and
 * the chat's routes read and send their messages.
 */
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
  ...conversationRoutesAt(PROJECT_PATH, "live"),
}
