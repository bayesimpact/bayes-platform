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
  const findAgentIdsBySettingsIds = jest.fn()
  const connectScope = { organizationId: "organization-1", projectId: "project-1" }

  const service = new McpAppHtmlService(
    { connect } as never,
    { getEnabledServersForAgent } as never,
    { findAgentIdsBySettingsIds } as never,
  )

  beforeEach(() => {
    close.mockReset()
    readResource.mockReset()
    connect.mockReset()
    getEnabledServersForAgent.mockReset()
    findAgentIdsBySettingsIds.mockReset()
    findAgentIdsBySettingsIds.mockResolvedValue(new Map())
    connect.mockResolvedValue({ close, readResource, tools: {} })
    getEnabledServersForAgent.mockResolvedValue([{ id: mcpServerId, url: "http://mcp.test" }])
  })

  it("reads current HTML from the persisted server and uri, not a stored snapshot", async () => {
    readResource.mockResolvedValue(mcpAppResource("<html>new card</html>"))

    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      connectScope,
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
    expect(htmlByKey.get(mcpAppHtmlCacheKey(mcpServerId, resourceUri))).toEqual({
      html: "<html>new card</html>",
    })
    expect(close).toHaveBeenCalled()
  })

  it("does not connect when no message has an MCP App pointer", async () => {
    const htmlByKey = await service.readLiveHtml({
      agentId: "agent-1",
      connectScope,
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
      connectScope,
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
      connectScope,
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
      connectScope,
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

  describe("after a handoff to a sub-agent", () => {
    const subAgentMessage = {
      agentSettings: { agentId: "sub-agent" },
      toolCalls: [
        {
          id: "call-1",
          name: "orienter_grand_age",
          arguments: {},
          mcpApp: { mcpServerId, resourceUri },
        },
      ],
    }

    beforeEach(() => {
      // The server is enabled for the sub-agent only, not for the meta-agent of the session.
      getEnabledServersForAgent.mockImplementation(async (agentId: string) =>
        agentId === "sub-agent" ? [{ id: mcpServerId, url: "http://mcp.test" }] : [],
      )
    })

    it("reads the card of a sub-agent message from the sub-agent's own server", async () => {
      readResource.mockResolvedValue(mcpAppResource("<html>sub-agent card</html>"))

      const htmlByKey = await service.readLiveHtml({
        agentId: "meta-agent",
        connectScope,
        sessionId: "session-1",
        messages: [subAgentMessage],
      })

      expect(htmlByKey.get(mcpAppHtmlCacheKey(mcpServerId, resourceUri))).toEqual({
        html: "<html>sub-agent card</html>",
      })
      expect(connect).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { agentId: "sub-agent", sessionId: "session-1", externalVisitorId: null },
        }),
      )
    })

    it("finds the author from the settings revision when the relation is not loaded", async () => {
      readResource.mockResolvedValue(mcpAppResource("<html>sub-agent card</html>"))
      findAgentIdsBySettingsIds.mockResolvedValue(new Map([["settings-sub", "sub-agent"]]))

      const htmlByKey = await service.readLiveHtml({
        agentId: "meta-agent",
        connectScope,
        sessionId: "session-1",
        messages: [{ agentSettingsId: "settings-sub", toolCalls: subAgentMessage.toolCalls }],
      })

      expect(findAgentIdsBySettingsIds).toHaveBeenCalledWith(connectScope, ["settings-sub"])
      expect(htmlByKey.size).toBe(1)
    })

    it("does not read a meta-agent pointer on a server only the sub-agent has", async () => {
      const htmlByKey = await service.readLiveHtml({
        agentId: "meta-agent",
        connectScope,
        sessionId: "session-1",
        messages: [{ ...subAgentMessage, agentSettings: { agentId: "meta-agent" } }],
      })

      expect(connect).not.toHaveBeenCalled()
      expect(htmlByKey.size).toBe(0)
    })

    it("reads a card once when two agents with the same server both show it", async () => {
      getEnabledServersForAgent.mockResolvedValue([{ id: mcpServerId, url: "http://mcp.test" }])
      readResource.mockResolvedValue(mcpAppResource("<html>card</html>"))

      await service.readLiveHtml({
        agentId: "meta-agent",
        connectScope,
        sessionId: "session-1",
        messages: [
          { ...subAgentMessage, agentSettings: { agentId: "meta-agent" } },
          subAgentMessage,
        ],
      })

      expect(readResource).toHaveBeenCalledTimes(1)
    })
  })
})
