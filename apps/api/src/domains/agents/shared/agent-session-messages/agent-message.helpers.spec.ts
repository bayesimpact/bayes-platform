import type { AgentMessage } from "./agent-message.entity"
import {
  applyLiveMcpAppHtml,
  mcpAppHtmlCacheKey,
  toDto,
  toDtos,
  toMcpAppHtmlDtos,
} from "./agent-message.helpers"

const resourceUri = "ui://patient-summary/mcp-app.html"
const mcpServerId = "mcp-server-1"

describe("toMcpAppHtmlDtos", () => {
  it("splits each cache key back into the server and uri the client matches on", () => {
    const htmlByKey = new Map([
      [mcpAppHtmlCacheKey(mcpServerId, resourceUri), "<html>card</html>"],
      [mcpAppHtmlCacheKey("mcp-server-2", "ui://other/app.html"), "<html>other</html>"],
    ])

    expect(toMcpAppHtmlDtos(htmlByKey)).toEqual([
      { mcpServerId, resourceUri, html: "<html>card</html>" },
      {
        mcpServerId: "mcp-server-2",
        resourceUri: "ui://other/app.html",
        html: "<html>other</html>",
      },
    ])
  })

  it("returns nothing when no card could be read", () => {
    expect(toMcpAppHtmlDtos(new Map())).toEqual([])
  })
})

describe("applyLiveMcpAppHtml", () => {
  it("hydrates live HTML onto the persisted MCP App pointer", () => {
    const htmlByKey = new Map([
      [mcpAppHtmlCacheKey(mcpServerId, resourceUri), "<html>new card</html>"],
    ])

    expect(
      applyLiveMcpAppHtml(
        [
          {
            id: "call-1",
            name: "get_patient",
            arguments: { patientId: "p-1" },
            result: { structuredContent: { title: "Ada" } },
            mcpApp: { mcpServerId, resourceUri },
          },
        ],
        htmlByKey,
      ),
    ).toEqual([
      {
        id: "call-1",
        name: "get_patient",
        arguments: { patientId: "p-1" },
        result: { structuredContent: { title: "Ada" } },
        mcpApp: {
          mcpServerId,
          resourceUri,
          html: "<html>new card</html>",
        },
      },
    ])
  })

  it("omits HTML when the live read is missing so a stale snapshot is never returned", () => {
    const [toolCall] =
      applyLiveMcpAppHtml(
        [
          {
            id: "call-1",
            name: "get_patient",
            arguments: {},
            mcpApp: { mcpServerId, resourceUri },
          },
        ],
        new Map(),
      ) ?? []

    expect(toolCall?.mcpApp).toEqual({ mcpServerId, resourceUri })
  })
})

describe("toDto", () => {
  const createdAt = new Date("2026-01-15T12:00:00.000Z")

  function buildMessage(overrides: Partial<AgentMessage> = {}): AgentMessage {
    return {
      id: "message-1",
      role: "assistant",
      content: "Hello",
      status: "completed",
      createdAt,
      startedAt: createdAt,
      completedAt: createdAt,
      agentSettings: { revision: 4 },
      toolCalls: null,
      attachmentDocumentId: null,
      ...overrides,
    } as AgentMessage
  }

  it("maps a message to a DTO and hydrates live MCP App HTML", () => {
    const htmlByKey = new Map([
      [mcpAppHtmlCacheKey(mcpServerId, resourceUri), "<html>live card</html>"],
    ])
    const message = buildMessage({
      toolCalls: [
        {
          id: "call-1",
          name: "get_patient",
          arguments: {},
          mcpApp: { mcpServerId, resourceUri },
        },
      ],
    })

    expect(toDto(message, htmlByKey)).toEqual({
      id: "message-1",
      role: "assistant",
      content: "Hello",
      status: "completed",
      createdAt: createdAt.getTime(),
      startedAt: createdAt.getTime(),
      completedAt: createdAt.getTime(),
      agentRevision: 4,
      toolCalls: [
        {
          id: "call-1",
          name: "get_patient",
          arguments: {},
          mcpApp: { mcpServerId, resourceUri, html: "<html>live card</html>" },
        },
      ],
      attachmentDocumentId: undefined,
    })
  })

  it("keeps the MCP App pointer without HTML when no live map is given", () => {
    // The message list is served without HTML: the client loads it separately so the
    // transcript never waits on an MCP server.
    const message = buildMessage({
      toolCalls: [
        {
          id: "call-1",
          name: "get_patient",
          arguments: {},
          mcpApp: { mcpServerId, resourceUri },
        },
      ],
    })

    expect(toDto(message).toolCalls?.[0]?.mcpApp).toEqual({ mcpServerId, resourceUri })
  })

  it("throws when agent settings are not loaded", () => {
    const message = buildMessage({ agentSettings: undefined })
    expect(() => toDto(message)).toThrow("Agent settings must be loaded to convert message to DTO")
  })
})

describe("toDtos", () => {
  it("maps each message", () => {
    const createdAt = new Date("2026-01-15T12:00:00.000Z")
    const messages = [
      {
        id: "message-1",
        role: "user",
        content: "Hi",
        status: "completed",
        createdAt,
        startedAt: createdAt,
        completedAt: createdAt,
        agentSettings: { revision: 1 },
        toolCalls: null,
        attachmentDocumentId: null,
      },
      {
        id: "message-2",
        role: "assistant",
        content: "Hello",
        status: "completed",
        createdAt,
        startedAt: createdAt,
        completedAt: createdAt,
        agentSettings: { revision: 1 },
        toolCalls: null,
        attachmentDocumentId: null,
      },
    ] as AgentMessage[]

    expect(toDtos(messages).map((dto) => dto.id)).toEqual(["message-1", "message-2"])
  })
})
