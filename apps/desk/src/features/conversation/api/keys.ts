export const conversationKeys = {
  all: ["conversations"] as const,
  messages: (agentSessionId: string) =>
    [...conversationKeys.all, agentSessionId, "messages"] as const,
}

export const documentKeys = {
  all: ["documents"] as const,
  isPublic: (documentId: string) => [...documentKeys.all, documentId, "is-public"] as const,
}
