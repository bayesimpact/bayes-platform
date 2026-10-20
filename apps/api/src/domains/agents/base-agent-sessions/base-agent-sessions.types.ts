export type BaseAgentSessionType = "playground" | "live"

/**
 * What a conversation session is for: the playground and live uses, plus a tester's conversation
 * in a review campaign. A relay sub-session takes its parent's type.
 */
export type ConversationAgentSessionType = BaseAgentSessionType | "review_campaign_tester"
