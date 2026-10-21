export const conversationKeys = {
  all: ["conversations"] as const,
  messages: (agentSessionId: string) =>
    [...conversationKeys.all, agentSessionId, "messages"] as const,
}
