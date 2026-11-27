import { describe, expect, it } from "vitest"
import { mockRoute } from "../test/mock-route"
import { server } from "../test/server"
import { createTestChat, createTestQueryClient, testRoutes } from "../test/test-chat"

const conversation = {
  organizationId: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  agentId: crypto.randomUUID(),
  agentSessionId: crypto.randomUUID(),
}

describe("createChat", () => {
  it("keeps the query keys the apps' caches and invalidations use", () => {
    const chat = createTestChat()
    const documentId = crypto.randomUUID()
    expect(chat.messagesQueryOptions(conversation).queryKey).toEqual([
      "conversations",
      conversation.agentSessionId,
      "messages",
    ])
    expect(chat.mcpAppsHtmlQueryOptions(conversation).queryKey).toEqual([
      "conversations",
      conversation.agentSessionId,
      "mcp-apps",
    ])
    expect(chat.documentIsPublicQueryOptions({ ...conversation, documentId }).queryKey).toEqual([
      "documents",
      documentId,
      "is-public",
    ])
  })

  it("reads a conversation's messages through the app's routes and client", async () => {
    const requestedPaths: string[] = []
    server.use(
      mockRoute(testRoutes.conversation.getMessages, ({ request }) => {
        requestedPaths.push(new URL(request.url).pathname)
        return [
          { id: crypto.randomUUID(), role: "user", content: "Hello" },
          { id: crypto.randomUUID(), role: "assistant", content: "Hi", status: "completed" },
        ]
      }),
    )
    const chat = createTestChat()

    const messages = await createTestQueryClient().fetchQuery(
      chat.messagesQueryOptions(conversation),
    )

    expect(messages.map((message) => message.role)).toEqual(["user", "assistant"])
    expect(requestedPaths).toEqual([
      `/api/test/organizations/${conversation.organizationId}/projects/${conversation.projectId}/agents/${conversation.agentId}/agent-sessions/live/${conversation.agentSessionId}/messages`,
    ])
  })

  it("reads whether a cited document is public, and the HTML of the MCP Apps", async () => {
    const mcpApp = { mcpServerId: crypto.randomUUID(), resourceUri: "ui://app", html: "<p>App</p>" }
    server.use(
      mockRoute(testRoutes.documents.getIsPublic, () => ({ isPublicDocument: true })),
      mockRoute(testRoutes.conversation.getMcpAppsHtml, () => [mcpApp]),
    )
    const chat = createTestChat()
    const queryClient = createTestQueryClient()

    const isPublic = await queryClient.fetchQuery(
      chat.documentIsPublicQueryOptions({ ...conversation, documentId: crypto.randomUUID() }),
    )
    const mcpApps = await queryClient.fetchQuery(chat.mcpAppsHtmlQueryOptions(conversation))

    expect(isPublic).toBe(true)
    expect(mcpApps).toEqual([mcpApp])
  })
})
