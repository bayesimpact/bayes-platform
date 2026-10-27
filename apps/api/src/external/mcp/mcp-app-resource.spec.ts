import { MCP_APP_MIME_TYPE, McpAppResourceError, readMcpAppResource } from "./mcp-app-resource"

const resourceUri = "ui://summary/mcp-app.html"

describe("readMcpAppResource", () => {
  it("returns HTML for a valid MCP App resource", () => {
    const { html, csp } = readMcpAppResource({
      resourceUri,
      resource: {
        contents: [
          {
            uri: resourceUri,
            mimeType: MCP_APP_MIME_TYPE,
            text: "<html><body>Summary</body></html>",
          },
        ],
      },
    })

    expect(html).toContain("Summary")
    expect(csp).toBeUndefined()
  })

  it("returns the domains the app declares in _meta.ui.csp", () => {
    const { csp } = readMcpAppResource({
      resourceUri,
      resource: {
        contents: [
          {
            uri: resourceUri,
            mimeType: MCP_APP_MIME_TYPE,
            text: "<html></html>",
            _meta: {
              ui: {
                csp: {
                  connectDomains: ["https://api.example.com", 42],
                  resourceDomains: ["https://cdn.example.com"],
                  frameDomains: "https://not-a-list.example.com",
                },
              },
            },
          },
        ],
      },
    })

    expect(csp).toEqual({
      connectDomains: ["https://api.example.com"],
      resourceDomains: ["https://cdn.example.com"],
    })
  })

  it("rejects undeclared non-ui URIs", () => {
    expect(() =>
      readMcpAppResource({
        resourceUri: "https://evil.example/app.html",
        resource: { contents: [] },
      }),
    ).toThrow(McpAppResourceError)
  })

  it("rejects a missing resource", () => {
    expect(() =>
      readMcpAppResource({
        resourceUri,
        resource: { contents: [] },
      }),
    ).toThrow(/not found/)
  })

  it("rejects the wrong MIME type", () => {
    expect(() =>
      readMcpAppResource({
        resourceUri,
        resource: {
          contents: [{ uri: resourceUri, mimeType: "text/html", text: "<html></html>" }],
        },
      }),
    ).toThrow(/MIME type/)
  })

  it("rejects a malformed resource with no HTML payload", () => {
    expect(() =>
      readMcpAppResource({
        resourceUri,
        resource: {
          contents: [{ uri: resourceUri, mimeType: MCP_APP_MIME_TYPE }],
        },
      }),
    ).toThrow(/Malformed/)
  })
})
