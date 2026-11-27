const CONVERSATIONS = "conversations"
const DOCUMENTS = "documents"

/**
 * The query keys of the chat. Their values are the ones the apps' caches and invalidations use:
 * an app reads or invalidates a query through the `queryKey` of its query options on the chat.
 */
export const chatKeys = {
  messages: (agentSessionId: string) => [CONVERSATIONS, agentSessionId, "messages"] as const,
  mcpApps: (agentSessionId: string) => [CONVERSATIONS, agentSessionId, "mcp-apps"] as const,
  documentIsPublic: (documentId: string) => [DOCUMENTS, documentId, "is-public"] as const,
}
