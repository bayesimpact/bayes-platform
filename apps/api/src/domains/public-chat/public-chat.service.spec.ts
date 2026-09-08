import type { AgentMessage } from "@/domains/agents/shared/agent-session-messages/agent-message.entity"
import { mcpAppHtmlCacheKey } from "@/domains/agents/shared/agent-session-messages/agent-message.helpers"
import { publicAgentSessionFactory } from "./public-agent-sessions/public-agent-session.factory"
import { PublicChatService } from "./public-chat.service"

const resourceUri = "ui://patient-summary/mcp-app.html"
const mcpServerId = "mcp-server-1"
const html = "<html>live card</html>"
const createdAt = new Date("2026-01-01T10:00:00Z")

function buildAssistantMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Hello",
    status: "completed",
    createdAt,
    startedAt: createdAt,
    completedAt: createdAt,
    agentSettings: { revision: 1 },
    toolCalls: null,
    attachmentDocumentId: null,
    ...overrides,
  } as AgentMessage
}

describe("PublicChatService", () => {
  const session = publicAgentSessionFactory.build({ externalVisitorId: "visitor-1" })
  const messageWithCard = buildAssistantMessage({
    content: "Here is the summary.",
    toolCalls: [
      {
        id: "call-1",
        name: "get_patient",
        arguments: { patientId: "p-1" },
        result: { structuredContent: { title: "Ada" } },
        mcpApp: { mcpServerId, resourceUri },
      },
    ],
  })

  function buildService(readLiveHtml: jest.Mock, messages: AgentMessage[]) {
    return new PublicChatService(
      {} as never,
      { getLast: jest.fn().mockResolvedValue({ locale: "fr" }) } as never,
      {} as never,
      { getSessionWithMessages: jest.fn().mockResolvedValue({ session, messages }) } as never,
      {} as never,
      { readLiveHtml } as never,
    )
  }

  it("returns the session with card pointers without reading any MCP server", async () => {
    // The widget shows the transcript at once and loads the card HTML afterwards.
    const readLiveHtml = jest.fn()
    const service = buildService(readLiveHtml, [messageWithCard])

    const dto = await service.getSession(session)

    expect(readLiveHtml).not.toHaveBeenCalled()
    expect(dto.messages[0]?.toolCalls?.[0]?.mcpApp).toEqual({ mcpServerId, resourceUri })
  })

  it("reads the current HTML of the cards the session points at", async () => {
    const readLiveHtml = jest
      .fn()
      .mockResolvedValue(new Map([[mcpAppHtmlCacheKey(mcpServerId, resourceUri), html]]))
    const service = buildService(readLiveHtml, [messageWithCard])

    const entries = await service.getMcpAppHtml(session)

    expect(readLiveHtml).toHaveBeenCalledWith({
      agentId: session.agentId,
      sessionId: session.id,
      messages: [messageWithCard],
      externalVisitorId: "visitor-1",
      locale: "fr",
    })
    expect(entries).toEqual([{ mcpServerId, resourceUri, html }])
  })

  it("omits toolCalls when the message has none", async () => {
    const service = buildService(jest.fn(), [buildAssistantMessage()])

    const dto = await service.getSession(session)

    expect(dto.messages[0]?.toolCalls).toBeUndefined()
  })
})
