import { conversationRoutesAt } from "@caseai-connect/chat-contracts"
import { PROJECT_PATH } from "../common/params.dto"

/**
 * A tester's conversation with a campaign's agent, in a session the campaign started: its messages,
 * its files and the stream of the agent's replies.
 */
export const EvalConversationsRoutes = conversationRoutesAt(PROJECT_PATH, "review_campaign_tester")
