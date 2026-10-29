import { MCP_APP_MIME_TYPE } from "@/external/mcp/mcp-app-resource"
import { mcpAppHtmlCacheKey } from "./agent-message.helpers"
import { McpAppHtmlService } from "./mcp-app-html.service"

const resourceUri = "ui://patient-summary/mcp-app.html"
const mcpServerId = "mcp-server-1"

function mcpAppResource(html: string) {
  return {
    contents: [{ uri: resourceUri, mimeType: MCP_APP_MIME_TYPE, text: html }],
  }
}

describe("McpAppHtmlService", () => {
  const close = jest.fn()
  const readResource = jest.fn()
  const connect = jest.fn()
  const getEnabledServersForAgent = jest.fn()

  const service = new McpAppHtmlService(
    { connect } as never,
    { getEnabledServersForAgent } as never,
  )

  beforeEach(() => {
    close.mockReset()
    readResource.mockReset()
    connect.mockReset()
    getEnabledServersForAgent.mockReset()
    connect.mockResolvedValue({ close, readResource, tools: {} })
    getEnabledServersForAgent.mockResolvedValue([{ id: mcpServerId, url: "http://mcp.test" }])
  })

  it("reads current HTML from the persisted server and uri, not a stored snapshot", async () => {
    readResource.mockResolvedValue(mcpAppResource("<html>new card</html>"))

    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      sessionId: "session-1",
      messages: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "get_patient",
              arguments: {},
              mcpApp: { mcpServerId, resourceUri },
            },
          ],
        },
      ],
    })

    expect(readResource).toHaveBeenCalledWith(resourceUri)
    expect(htmlByKey.get(mcpAppHtmlCacheKey(mcpServerId, resourceUri))).toBe(
      "<html>new card</html>",
    )
    expect(close).toHaveBeenCalled()
  })

  it("does not connect when no message has an MCP App pointer", async () => {
    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      sessionId: "session-1",
      messages: [{ toolCalls: [{ id: "call-1", name: "search_resources", arguments: {} }] }],
    })

    expect(getEnabledServersForAgent).not.toHaveBeenCalled()
    expect(connect).not.toHaveBeenCalled()
    expect(htmlByKey.size).toBe(0)
  })

  it("does not read a resource from a server that is no longer enabled for the agent", async () => {
    getEnabledServersForAgent.mockResolvedValue([])

    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      sessionId: "session-1",
      messages: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "get_patient",
              arguments: {},
              mcpApp: { mcpServerId, resourceUri },
            },
          ],
        },
      ],
    })

    expect(connect).not.toHaveBeenCalled()
    expect(htmlByKey.size).toBe(0)
  })

  it("ignores non-ui URIs stored on a message", async () => {
    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      sessionId: "session-1",
      messages: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "get_patient",
              arguments: {},
              mcpApp: {
                mcpServerId,
                resourceUri: "https://evil.example/app.html",
              },
            },
          ],
        },
      ],
    })

    expect(connect).not.toHaveBeenCalled()
    expect(htmlByKey.size).toBe(0)
  })

  it("forwards the public session visitor id on the MCP connection", async () => {
    readResource.mockResolvedValue(mcpAppResource("<html>card</html>"))

    await service.readLiveHtml({
      agentId: "agent-1",
      sessionId: "session-1",
      externalVisitorId: "visitor-1",
      messages: [
        {
          toolCalls: [
            {
              id: "call-1",
              name: "get_patient",
              arguments: {},
              mcpApp: { mcpServerId, resourceUri },
            },
          ],
        },
      ],
    })

    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          agentId: "agent-1",
          sessionId: "session-1",
          externalVisitorId: "visitor-1",
        },
      }),
    )
  })
})
