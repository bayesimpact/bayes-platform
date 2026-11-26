import { defineConversationRoutes } from "@caseai-connect/chat-contracts"

/**
 * A tester's conversation with a campaign's agent, in a session the campaign started: its messages,
 * its files and the stream of the agent's replies.
 */
export const EvalConversationsRoutes = defineConversationRoutes("eval", "review_campaign_tester")
