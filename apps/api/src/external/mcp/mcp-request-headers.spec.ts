import { buildMcpRequestHeaders, MCP_CONTEXT_HEADERS } from "./mcp-request-headers"

describe("buildMcpRequestHeaders", () => {
  const context = {
    agentId: "agent-1",
    sessionId: "session-1",
    externalVisitorId: "visitor-1",
  }

  it("forwards the conversation context on every call", () => {
    const headers = buildMcpRequestHeaders({ context })

    expect(headers[MCP_CONTEXT_HEADERS.agentId]).toBe("agent-1")
    expect(headers[MCP_CONTEXT_HEADERS.sessionId]).toBe("session-1")
    expect(headers[MCP_CONTEXT_HEADERS.externalVisitorId]).toBe("visitor-1")
  })

  it("omits the external visitor header when the session has none", () => {
    const headers = buildMcpRequestHeaders({
      context: { agentId: "agent-1", sessionId: "session-1", externalVisitorId: null },
    })

    expect(headers).not.toHaveProperty(MCP_CONTEXT_HEADERS.externalVisitorId)
    expect(headers[MCP_CONTEXT_HEADERS.sessionId]).toBe("session-1")
  })

  it("keeps the server's auth and its static headers", () => {
    const headers = buildMcpRequestHeaders({
      apiKey: "secret",
      staticHeaders: { "X-Api-Version": "2" },
      context,
    })

    expect(headers.Authorization).toBe("Bearer secret")
    expect(headers["X-Api-Version"]).toBe("2")
  })

  it("does not let static headers spoof the conversation context", () => {
    const headers = buildMcpRequestHeaders({
      staticHeaders: { [MCP_CONTEXT_HEADERS.agentId]: "someone-else" },
      context,
    })

    expect(headers[MCP_CONTEXT_HEADERS.agentId]).toBe("agent-1")
  })

  it("drops empty header names and values, which would break the transport", () => {
    const headers = buildMcpRequestHeaders({
      staticHeaders: { "  ": "value", "X-Empty": "   ", "X-Kept": "  yes  " },
    })

    expect(Object.keys(headers)).toEqual(["X-Kept"])
    expect(headers["X-Kept"]).toBe("yes")
  })

  it("sends nothing when there is no auth, no static header and no context", () => {
    expect(buildMcpRequestHeaders({})).toEqual({})
  })
})
